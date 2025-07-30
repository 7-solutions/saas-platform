import { logApiError, logNetworkError } from '../utils/error-logger';
export class ApiClient {
    baseUrl;
    accessToken = null;
    refreshToken = null;
    onTokenRefresh;
    onAuthError;
    onRequestStart;
    onRequestEnd;
    onError;
    refreshPromise = null;
    retryConfig;
    constructor(config) {
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
    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }
    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.refreshPromise = null;
    }
    async refreshAccessToken() {
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
        }
        finally {
            this.refreshPromise = null;
        }
    }
    async performTokenRefresh() {
        const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh_token: this.refreshToken,
            }),
        });
        if (!response.ok) {
            this.clearTokens();
            this.onAuthError?.();
            throw new Error('Failed to refresh token');
        }
        const data = await response.json();
        this.setTokens(data.access_token, data.refresh_token);
        this.onTokenRefresh?.(data);
        return data.access_token;
    }
    async makeRequest(endpoint, options = {}) {
        return this.makeRequestWithRetry(endpoint, options, 0);
    }
    async makeRequestWithRetry(endpoint, options, retryCount) {
        const url = `${this.baseUrl}${endpoint}`;
        const method = options.method || 'GET';
        // Prepare headers
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
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
                }
                catch (refreshError) {
                    // Refresh failed, return the original 401 response
                    const errorResponse = await this.handleErrorResponse(response);
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
                return this.makeRequestWithRetry(endpoint, options, retryCount + 1);
            }
            if (!response.ok) {
                const errorResponse = await this.handleErrorResponse(response);
                if (errorResponse.error) {
                    logApiError(errorResponse.error, url, method);
                    this.onError?.(errorResponse.error, url);
                }
                return errorResponse;
            }
            // Handle empty responses (like DELETE operations)
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return { data: {} };
            }
            const data = await response.json();
            return { data };
        }
        catch (error) {
            // Check if we should retry network errors
            if (this.shouldRetry(0, retryCount)) {
                const delay = this.calculateRetryDelay(retryCount);
                await this.sleep(delay);
                return this.makeRequestWithRetry(endpoint, options, retryCount + 1);
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
    shouldRetry(statusCode, retryCount) {
        if (retryCount >= this.retryConfig.maxRetries) {
            return false;
        }
        // Always retry network errors (statusCode 0)
        if (statusCode === 0) {
            return true;
        }
        return this.retryConfig.retryableStatusCodes.includes(statusCode);
    }
    calculateRetryDelay(retryCount) {
        const baseDelay = this.retryConfig.retryDelay;
        if (this.retryConfig.exponentialBackoff) {
            return baseDelay * Math.pow(2, retryCount) + Math.random() * 1000; // Add jitter
        }
        return baseDelay;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async handleErrorResponse(response) {
        try {
            const errorData = await response.json();
            return {
                error: {
                    code: errorData.code || 'UNKNOWN_ERROR',
                    message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                    details: errorData.details,
                },
            };
        }
        catch {
            return {
                error: {
                    code: 'HTTP_ERROR',
                    message: `HTTP ${response.status}: ${response.statusText}`,
                },
            };
        }
    }
    // Auth methods
    async login(request) {
        const response = await this.makeRequest('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify(request),
        });
        if (response.data) {
            this.setTokens(response.data.access_token, response.data.refresh_token);
        }
        return response;
    }
    async validateToken(request) {
        return this.makeRequest('/api/v1/auth/validate', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }
    async logout(request) {
        const response = await this.makeRequest('/api/v1/auth/logout', {
            method: 'POST',
            body: JSON.stringify(request),
        });
        this.clearTokens();
        return response;
    }
    // Generic request methods for other services
    async get(endpoint, params) {
        const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
        return this.makeRequest(url, { method: 'GET' });
    }
    async post(endpoint, data) {
        return this.makeRequest(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        });
    }
    async put(endpoint, data) {
        return this.makeRequest(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        });
    }
    async delete(endpoint) {
        return this.makeRequest(endpoint, { method: 'DELETE' });
    }
    // File upload method for media
    async uploadFile(endpoint, file, additionalData) {
        const formData = new FormData();
        formData.append('file', file);
        if (additionalData) {
            Object.entries(additionalData).forEach(([key, value]) => {
                formData.append(key, value);
            });
        }
        const headers = {};
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
                }
                catch (refreshError) {
                    return this.handleErrorResponse(response);
                }
            }
            if (!response.ok) {
                return this.handleErrorResponse(response);
            }
            const data = await response.json();
            return { data };
        }
        catch (error) {
            return {
                error: {
                    code: 'NETWORK_ERROR',
                    message: error instanceof Error ? error.message : 'File upload failed',
                },
            };
        }
    }
    // Utility method to check if client is authenticated
    isAuthenticated() {
        return this.accessToken !== null;
    }
    // Utility method to get current access token
    getAccessToken() {
        return this.accessToken;
    }
}
// Factory function to create a configured API client
export function createApiClient(config) {
    return new ApiClient(config);
}
// Default configuration for development
export const defaultApiClientConfig = {
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
