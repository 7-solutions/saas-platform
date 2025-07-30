import type { ApiResponse, ApiError } from './types';
/**
 * Type guard to check if an API response contains an error
 */
export declare function isApiError<T>(response: ApiResponse<T>): response is {
    error: ApiError;
};
/**
 * Type guard to check if an API response contains data
 */
export declare function isApiSuccess<T>(response: ApiResponse<T>): response is {
    data: T;
};
/**
 * Extract data from API response or throw error
 */
export declare function unwrapApiResponse<T>(response: ApiResponse<T>): T;
/**
 * Custom error class for API responses
 */
export declare class ApiResponseError extends Error {
    readonly code: string;
    readonly details?: Array<{
        field: string;
        message: string;
    }>;
    constructor(apiError: ApiError);
    /**
     * Check if this is a specific error code
     */
    is(code: string): boolean;
    /**
     * Check if this is a validation error
     */
    isValidationError(): boolean;
    /**
     * Check if this is an authentication error
     */
    isAuthError(): boolean;
    /**
     * Get validation errors for a specific field
     */
    getFieldErrors(field: string): string[];
    /**
     * Get all validation errors as a map
     */
    getFieldErrorsMap(): Record<string, string[]>;
}
/**
 * Utility function to handle API responses in a consistent way
 */
export declare function handleApiResponse<T>(responsePromise: Promise<ApiResponse<T>>, options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: ApiResponseError) => void;
    throwOnError?: boolean;
}): Promise<T | null>;
/**
 * Utility to create a retry function for API calls
 */
export declare function createRetryFunction<T>(apiCall: () => Promise<ApiResponse<T>>, options?: {
    maxRetries?: number;
    retryDelay?: number;
    shouldRetry?: (error: ApiResponseError) => boolean;
}): () => Promise<ApiResponse<T>>;
//# sourceMappingURL=utils.d.ts.map