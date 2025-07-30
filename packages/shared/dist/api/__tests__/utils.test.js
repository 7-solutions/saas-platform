import { describe, it, expect, vi } from 'vitest';
import { isApiError, isApiSuccess, unwrapApiResponse, ApiResponseError, handleApiResponse, createRetryFunction, } from '../utils';
describe('API Utils', () => {
    describe('isApiError', () => {
        it('should return true for error responses', () => {
            const response = {
                error: { code: 'TEST_ERROR', message: 'Test error' },
            };
            expect(isApiError(response)).toBe(true);
        });
        it('should return false for success responses', () => {
            const response = {
                data: { test: 'data' },
            };
            expect(isApiError(response)).toBe(false);
        });
    });
    describe('isApiSuccess', () => {
        it('should return true for success responses', () => {
            const response = {
                data: { test: 'data' },
            };
            expect(isApiSuccess(response)).toBe(true);
        });
        it('should return false for error responses', () => {
            const response = {
                error: { code: 'TEST_ERROR', message: 'Test error' },
            };
            expect(isApiSuccess(response)).toBe(false);
        });
    });
    describe('unwrapApiResponse', () => {
        it('should return data for success responses', () => {
            const testData = { test: 'data' };
            const response = { data: testData };
            expect(unwrapApiResponse(response)).toEqual(testData);
        });
        it('should throw ApiResponseError for error responses', () => {
            const response = {
                error: { code: 'TEST_ERROR', message: 'Test error' },
            };
            expect(() => unwrapApiResponse(response)).toThrow(ApiResponseError);
        });
        it('should throw error for invalid response format', () => {
            const response = {};
            expect(() => unwrapApiResponse(response)).toThrow('Invalid API response format');
        });
    });
    describe('ApiResponseError', () => {
        it('should create error with correct properties', () => {
            const apiError = {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: [
                    { field: 'email', message: 'Email is required' },
                    { field: 'password', message: 'Password is too short' },
                ],
            };
            const error = new ApiResponseError(apiError);
            expect(error.name).toBe('ApiResponseError');
            expect(error.message).toBe('Validation failed');
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.details).toEqual(apiError.details);
        });
        describe('is', () => {
            it('should check error code correctly', () => {
                const error = new ApiResponseError({
                    code: 'VALIDATION_ERROR',
                    message: 'Test error',
                });
                expect(error.is('VALIDATION_ERROR')).toBe(true);
                expect(error.is('OTHER_ERROR')).toBe(false);
            });
        });
        describe('isValidationError', () => {
            it('should return true for validation errors', () => {
                const error = new ApiResponseError({
                    code: 'VALIDATION_ERROR',
                    message: 'Test error',
                });
                expect(error.isValidationError()).toBe(true);
            });
            it('should return false for non-validation errors', () => {
                const error = new ApiResponseError({
                    code: 'NETWORK_ERROR',
                    message: 'Test error',
                });
                expect(error.isValidationError()).toBe(false);
            });
        });
        describe('isAuthError', () => {
            it('should return true for auth errors', () => {
                const unauthorizedError = new ApiResponseError({
                    code: 'UNAUTHORIZED',
                    message: 'Unauthorized',
                });
                const credentialsError = new ApiResponseError({
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid credentials',
                });
                expect(unauthorizedError.isAuthError()).toBe(true);
                expect(credentialsError.isAuthError()).toBe(true);
            });
            it('should return false for non-auth errors', () => {
                const error = new ApiResponseError({
                    code: 'VALIDATION_ERROR',
                    message: 'Validation error',
                });
                expect(error.isAuthError()).toBe(false);
            });
        });
        describe('getFieldErrors', () => {
            it('should return errors for specific field', () => {
                const error = new ApiResponseError({
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: [
                        { field: 'email', message: 'Email is required' },
                        { field: 'email', message: 'Email format is invalid' },
                        { field: 'password', message: 'Password is too short' },
                    ],
                });
                expect(error.getFieldErrors('email')).toEqual([
                    'Email is required',
                    'Email format is invalid',
                ]);
                expect(error.getFieldErrors('password')).toEqual([
                    'Password is too short',
                ]);
                expect(error.getFieldErrors('nonexistent')).toEqual([]);
            });
            it('should return empty array when no details', () => {
                const error = new ApiResponseError({
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                });
                expect(error.getFieldErrors('email')).toEqual([]);
            });
        });
        describe('getFieldErrorsMap', () => {
            it('should return map of all field errors', () => {
                const error = new ApiResponseError({
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: [
                        { field: 'email', message: 'Email is required' },
                        { field: 'email', message: 'Email format is invalid' },
                        { field: 'password', message: 'Password is too short' },
                    ],
                });
                expect(error.getFieldErrorsMap()).toEqual({
                    email: ['Email is required', 'Email format is invalid'],
                    password: ['Password is too short'],
                });
            });
            it('should return empty object when no details', () => {
                const error = new ApiResponseError({
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                });
                expect(error.getFieldErrorsMap()).toEqual({});
            });
        });
    });
    describe('handleApiResponse', () => {
        it('should handle success response', async () => {
            const testData = { test: 'data' };
            const responsePromise = Promise.resolve({ data: testData });
            const onSuccess = vi.fn();
            const result = await handleApiResponse(responsePromise, { onSuccess });
            expect(result).toEqual(testData);
            expect(onSuccess).toHaveBeenCalledWith(testData);
        });
        it('should handle error response and throw by default', async () => {
            const responsePromise = Promise.resolve({
                error: { code: 'TEST_ERROR', message: 'Test error' },
            });
            const onError = vi.fn();
            await expect(handleApiResponse(responsePromise, { onError })).rejects.toThrow(ApiResponseError);
            expect(onError).toHaveBeenCalledWith(expect.any(ApiResponseError));
        });
        it('should handle error response without throwing when throwOnError is false', async () => {
            const responsePromise = Promise.resolve({
                error: { code: 'TEST_ERROR', message: 'Test error' },
            });
            const onError = vi.fn();
            const result = await handleApiResponse(responsePromise, {
                onError,
                throwOnError: false,
            });
            expect(result).toBeNull();
            expect(onError).toHaveBeenCalledWith(expect.any(ApiResponseError));
        });
        it('should handle network errors', async () => {
            const responsePromise = Promise.reject(new Error('Network error'));
            const onError = vi.fn();
            await expect(handleApiResponse(responsePromise, { onError })).rejects.toThrow(ApiResponseError);
            expect(onError).toHaveBeenCalledWith(expect.any(ApiResponseError));
        });
    });
    describe('createRetryFunction', () => {
        it('should retry failed requests', async () => {
            let attempts = 0;
            const apiCall = vi.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    return Promise.resolve({
                        error: { code: 'NETWORK_ERROR', message: 'Network error' },
                    });
                }
                return Promise.resolve({ data: { success: true } });
            });
            const retryFn = createRetryFunction(apiCall, {
                maxRetries: 3,
                retryDelay: 10, // Short delay for testing
            });
            const result = await retryFn();
            expect(apiCall).toHaveBeenCalledTimes(3);
            expect(result).toEqual({ data: { success: true } });
        });
        it('should not retry auth errors', async () => {
            const apiCall = vi.fn().mockResolvedValue({
                error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            });
            const retryFn = createRetryFunction(apiCall, {
                maxRetries: 3,
                retryDelay: 10,
            });
            const result = await retryFn();
            expect(apiCall).toHaveBeenCalledTimes(1);
            expect(result).toEqual({
                error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            });
        });
        it('should respect shouldRetry function', async () => {
            const apiCall = vi.fn().mockResolvedValue({
                error: { code: 'CUSTOM_ERROR', message: 'Custom error' },
            });
            const shouldRetry = vi.fn().mockReturnValue(false);
            const retryFn = createRetryFunction(apiCall, {
                maxRetries: 3,
                retryDelay: 10,
                shouldRetry,
            });
            const result = await retryFn();
            expect(apiCall).toHaveBeenCalledTimes(1);
            expect(shouldRetry).toHaveBeenCalledWith(expect.any(ApiResponseError));
            expect(result).toEqual({
                error: { code: 'CUSTOM_ERROR', message: 'Custom error' },
            });
        });
        it('should return error after max retries', async () => {
            const apiCall = vi.fn().mockResolvedValue({
                error: { code: 'NETWORK_ERROR', message: 'Network error' },
            });
            const retryFn = createRetryFunction(apiCall, {
                maxRetries: 2,
                retryDelay: 10,
            });
            const result = await retryFn();
            expect(apiCall).toHaveBeenCalledTimes(3); // Initial + 2 retries
            expect(result).toEqual({
                error: { code: 'NETWORK_ERROR', message: 'Network error' },
            });
        });
    });
});
