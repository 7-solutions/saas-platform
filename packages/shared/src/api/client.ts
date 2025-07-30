import type {
  ApiError,
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  ValidateTokenRequest,
  User,
  LogoutRequest,
  LogoutResponse,
} from './types';
import { logApiError, logNetworkError } from '../utils/error-logger';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatusCodes: number[];
  exponentialBackoff: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  onTokenRefresh?: (tokens: { access_token: string; refresh_token: string }) => void;
  onAuthError?: () => void;
  onRequestStart?: (url: string, options: RequestInit) => void;
  onRequestEnd?: (url: string, response: Response) => void;
  onError?: (error: ApiError, url: string) => void;
  retryConfig?: Partial<RetryConfig>;
}

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefresh?: (tokens: { access_token: string; refresh_token: string }) => void;
  private onAuthError?: () => void;
  private onRequestStart?: (url: string, options: RequestInit) => void;
  private onRequestEnd?: (url: string, response: Response) => void;
  private onError?: (error: ApiError, url: string) => void;
  private refreshPromise: Promise<string> | null = null;
  private retryConfig: RetryConfig;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.onTokenRefresh = config.onTokenRefresh;
    this.onAuthError = config.onAuthError;
    this.onRequestStart = config.onRequestStart;
    this.onRequestEnd = config.onRequestEnd;
    this.onError = config.onError;
    
    // Set up retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      exponentialBackoff: true,
      ...config.retryConfig,
    };
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.refreshPromise = null;
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const newAccessToken = await this.refreshPromise;
      return newAccessToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      } as RefreshTokenRequest),
    });

    if (!response.ok) {
      this.clearTokens();
      this.onAuthError?.();
      throw new Error('Failed to refresh token');
    }

    const data: LoginResponse = await response.json();
    this.setTokens(data.access_token, data.refresh_token);
    this.onTokenRefresh?.(data);
    
    return data.access_token;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    return this.makeRequestWithRetry<T>(endpoint, options, 0);
  }

  private async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    retryCount: number
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add authorization header if we have a token
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const requestOptions = {
        ...options,
        headers,
      };

      // Call request start interceptor
      this.onRequestStart?.(url, requestOptions);

      let response = await fetch(url, requestOptions);

      // Call request end interceptor
      this.onRequestEnd?.(url, response);

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && this.refreshToken && endpoint !== '/api/v1/auth/refresh') {
        try {
          await this.refreshAccessToken();
          // Retry the original request with new token
          headers.Authorization = `Bearer ${this.accessToken}`;
          response = await fetch(url, {
            ...options,
            headers,
          });
        } catch (refreshError) {
          // Refresh failed, return the original 401 response
          const errorResponse = await this.handleErrorResponse<T>(response);
          if (errorResponse.error) {
            logApiError(errorResponse.error, url, method);
            this.onError?.(errorResponse.error, url);
          }
          return errorResponse;
        }
      }

      // Check if we should retry based on status code
      if (!response.ok && this.shouldRetry(response.status, retryCount)) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        return this.makeRequestWithRetry<T>(endpoint, options, retryCount + 1);
      }

      if (!response.ok) {
        const errorResponse = await this.handleErrorResponse<T>(response);
        if (errorResponse.error) {
          logApiError(errorResponse.error, url, method);
          this.onError?.(errorResponse.error, url);
        }
        return errorResponse;
      }

      // Handle empty responses (like DELETE operations)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return { data: {} as T };
      }

      const data: T = await response.json();
      return { data };
    } catch (error) {
      // Check if we should retry network errors
      if (this.shouldRetry(0, retryCount)) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        return this.makeRequestWithRetry<T>(endpoint, options, retryCount + 1);
      }

      const apiError = {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      };
      
      logNetworkError(error, url);
      this.onError?.(apiError, url);
      
      return {
        error: apiError,
      };
    }
  }

  private shouldRetry(statusCode: number, retryCount: number): boolean {
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }

    // Always retry network errors (statusCode 0)
    if (statusCode === 0) {
      return true;
    }

    return this.retryConfig.retryableStatusCodes.includes(statusCode);
  }

  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.retryConfig.retryDelay;
    
    if (this.retryConfig.exponentialBackoff) {
      return baseDelay * Math.pow(2, retryCount) + Math.random() * 1000; // Add jitter
    }
    
    return baseDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async handleErrorResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const errorData = await response.json();
      return {
        error: {
          code: errorData.code || 'UNKNOWN_ERROR',
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          details: errorData.details,
        },
      };
    } catch {
      return {
        error: {
          code: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        },
      };
    }
  }

  // Auth methods
  async login(request: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.makeRequest<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (response.data) {
      this.setTokens(response.data.access_token, response.data.refresh_token);
    }

    return response;
  }

  async validateToken(request: ValidateTokenRequest): Promise<ApiResponse<User>> {
    return this.makeRequest<User>('/api/v1/auth/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async logout(request: LogoutRequest): Promise<ApiResponse<LogoutResponse>> {
    const response = await this.makeRequest<LogoutResponse>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    this.clearTokens();
    return response;
  }

  // Generic request methods for other services
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    return this.makeRequest<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  // File upload method for media
  async uploadFile(endpoint: string, file: File, additionalData?: Record<string, string>): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && this.refreshToken) {
        try {
          await this.refreshAccessToken();
          headers.Authorization = `Bearer ${this.accessToken}`;
          response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData,
          });
        } catch (refreshError) {
          return this.handleErrorResponse(response);
        }
      }

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'File upload failed',
        },
      };
    }
  }

  // Utility method to check if client is authenticated
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  // Utility method to get current access token
  getAccessToken(): string | null {
    return this.accessToken;
  }
}

// Factory function to create a configured API client
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

// Default configuration for development
export const defaultApiClientConfig: Partial<ApiClientConfig> = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  onTokenRefresh: (tokens) => {
    // Store tokens in localStorage by default
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
    }
  },
  onAuthError: () => {
    // Clear tokens from localStorage by default
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },
};