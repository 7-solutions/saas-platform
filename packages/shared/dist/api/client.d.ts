import type { ApiError, ApiResponse, LoginRequest, LoginResponse, ValidateTokenRequest, User, LogoutRequest, LogoutResponse } from './types';
export interface RetryConfig {
    maxRetries: number;
    retryDelay: number;
    retryableStatusCodes: number[];
    exponentialBackoff: boolean;
}
export interface ApiClientConfig {
    baseUrl: string;
    onTokenRefresh?: (tokens: {
        access_token: string;
        refresh_token: string;
    }) => void;
    onAuthError?: () => void;
    onRequestStart?: (url: string, options: RequestInit) => void;
    onRequestEnd?: (url: string, response: Response) => void;
    onError?: (error: ApiError, url: string) => void;
    retryConfig?: Partial<RetryConfig>;
}
export declare class ApiClient {
    private baseUrl;
    private accessToken;
    private refreshToken;
    private onTokenRefresh?;
    private onAuthError?;
    private onRequestStart?;
    private onRequestEnd?;
    private onError?;
    private refreshPromise;
    private retryConfig;
    constructor(config: ApiClientConfig);
    setTokens(accessToken: string, refreshToken: string): void;
    clearTokens(): void;
    private refreshAccessToken;
    private performTokenRefresh;
    private makeRequest;
    private makeRequestWithRetry;
    private shouldRetry;
    private calculateRetryDelay;
    private sleep;
    private handleErrorResponse;
    login(request: LoginRequest): Promise<ApiResponse<LoginResponse>>;
    validateToken(request: ValidateTokenRequest): Promise<ApiResponse<User>>;
    logout(request: LogoutRequest): Promise<ApiResponse<LogoutResponse>>;
    get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>>;
    post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>;
    put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>;
    delete<T>(endpoint: string): Promise<ApiResponse<T>>;
    uploadFile(endpoint: string, file: File, additionalData?: Record<string, string>): Promise<ApiResponse<any>>;
    isAuthenticated(): boolean;
    getAccessToken(): string | null;
}
export declare function createApiClient(config: ApiClientConfig): ApiClient;
export declare const defaultApiClientConfig: Partial<ApiClientConfig>;
//# sourceMappingURL=client.d.ts.map