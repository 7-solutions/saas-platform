import type { ApiResponse, ApiError } from './types';

/**
 * Type guard to check if an API response contains an error
 */
export function isApiError<T>(response: ApiResponse<T>): response is { error: ApiError } {
  return 'error' in response && response.error !== undefined;
}

/**
 * Type guard to check if an API response contains data
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is { data: T } {
  return 'data' in response && response.data !== undefined;
}

/**
 * Extract data from API response or throw error
 */
export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (isApiError(response)) {
    throw new ApiResponseError(response.error);
  }
  if (isApiSuccess(response)) {
    return response.data;
  }
  throw new Error('Invalid API response format');
}

/**
 * Custom error class for API responses
 */
export class ApiResponseError extends Error {
  public readonly code: string;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiResponseError';
    this.code = apiError.code;
    this.details = apiError.details;
  }

  /**
   * Check if this is a specific error code
   */
  is(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if this is a validation error
   */
  isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return this.code === 'UNAUTHORIZED' || this.code === 'INVALID_CREDENTIALS';
  }

  /**
   * Get validation errors for a specific field
   */
  getFieldErrors(field: string): string[] {
    if (!this.details) return [];
    return this.details
      .filter(detail => detail.field === field)
      .map(detail => detail.message);
  }

  /**
   * Get all validation errors as a map
   */
  getFieldErrorsMap(): Record<string, string[]> {
    if (!this.details) return {};
    
    const errorMap: Record<string, string[]> = {};
    for (const detail of this.details) {
      if (!errorMap[detail.field]) {
        errorMap[detail.field] = [];
      }
      errorMap[detail.field].push(detail.message);
    }
    return errorMap;
  }
}

/**
 * Utility function to handle API responses in a consistent way
 */
export async function handleApiResponse<T>(
  responsePromise: Promise<ApiResponse<T>>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: ApiResponseError) => void;
    throwOnError?: boolean;
  }
): Promise<T | null> {
  try {
    const response = await responsePromise;
    
    if (isApiSuccess(response)) {
      options?.onSuccess?.(response.data);
      return response.data;
    }
    
    if (isApiError(response)) {
      const error = new ApiResponseError(response.error);
      options?.onError?.(error);
      
      if (options?.throwOnError !== false) {
        throw error;
      }
    }
    
    return null;
  } catch (error) {
    if (error instanceof ApiResponseError) {
      options?.onError?.(error);
      if (options?.throwOnError !== false) {
        throw error;
      }
    } else {
      // Network or other errors
      const apiError = new ApiResponseError({
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      options?.onError?.(apiError);
      if (options?.throwOnError !== false) {
        throw apiError;
      }
    }
    return null;
  }
}

/**
 * Utility to create a retry function for API calls
 */
export function createRetryFunction<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    shouldRetry?: (error: ApiResponseError) => boolean;
  } = {}
) {
  const { maxRetries = 3, retryDelay = 1000, shouldRetry } = options;

  return async function retryApiCall(): Promise<ApiResponse<T>> {
    let lastError: ApiResponseError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await apiCall();
        
        if (isApiSuccess(response)) {
          return response;
        }
        
        if (isApiError(response)) {
          const error = new ApiResponseError(response.error);
          
          // Don't retry if shouldRetry returns false
          if (shouldRetry && !shouldRetry(error)) {
            return response;
          }
          
          // Don't retry auth errors
          if (error.isAuthError()) {
            return response;
          }
          
          lastError = error;
          
          // If this is the last attempt, return the error
          if (attempt === maxRetries) {
            return response;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      } catch (error) {
        lastError = error instanceof ApiResponseError 
          ? error 
          : new ApiResponseError({
              code: 'NETWORK_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
        
        if (attempt === maxRetries) {
          return { error: lastError };
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    // This should never be reached, but just in case
    return { 
      error: lastError || { 
        code: 'UNKNOWN_ERROR', 
        message: 'Maximum retries exceeded' 
      } 
    };
  };
}