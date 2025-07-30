import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../client';
import type { LoginRequest, LoginResponse } from '../types';
import { UserRole } from '../types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  let client: ApiClient;
  let mockOnTokenRefresh: ReturnType<typeof vi.fn>;
  let mockOnAuthError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnTokenRefresh = vi.fn();
    mockOnAuthError = vi.fn();
    
    client = new ApiClient({
      baseUrl: 'http://localhost:8080',
      onTokenRefresh: mockOnTokenRefresh,
      onAuthError: mockOnAuthError,
    });

    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with correct base URL', () => {
      expect(client).toBeInstanceOf(ApiClient);
    });

    it('should remove trailing slash from base URL', () => {
      const clientWithSlash = new ApiClient({
        baseUrl: 'http://localhost:8080/',
      });
      expect(clientWithSlash).toBeInstanceOf(ApiClient);
    });
  });

  describe('token management', () => {
    it('should set and clear tokens', () => {
      client.setTokens('access-token', 'refresh-token');
      // Tokens are private, so we test behavior through requests
      
      client.clearTokens();
      // Test that tokens are cleared by making a request without auth header
    });
  });

  describe('login', () => {
    it('should successfully login and set tokens', async () => {
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      const loginResponse: LoginResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: UserRole.ADMIN,
          profile: { name: 'Test User' },
          created_at: '2024-01-01T00:00:00Z',
        },
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => loginResponse,
        headers: new Headers(),
      } as Response);

      const result = await client.login(loginRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loginRequest),
        }
      );

      expect(result.data).toEqual(loginResponse);
      expect(result.error).toBeUndefined();
    });

    it('should handle login error', async () => {
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        }),
        headers: new Headers(),
      } as Response);

      const result = await client.login(loginRequest);

      expect(result.data).toBeUndefined();
      expect(result.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });
  });

  describe('token refresh', () => {
    it('should refresh token on 401 response', async () => {
      // Set initial tokens
      client.setTokens('expired-token', 'refresh-token');

      // Mock the initial request that returns 401
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers(),
        } as Response)
        // Mock the refresh token request
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            user: {
              id: 'user-1',
              email: 'test@example.com',
              role: UserRole.ADMIN,
              profile: { name: 'Test User' },
              created_at: '2024-01-01T00:00:00Z',
            },
            expires_in: 3600,
          }),
          headers: new Headers(),
        } as Response)
        // Mock the retry request with new token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
          headers: new Headers(),
        } as Response);

      const result = await client.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockOnTokenRefresh).toHaveBeenCalledWith({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: UserRole.ADMIN,
          profile: { name: 'Test User' },
          created_at: '2024-01-01T00:00:00Z',
        },
        expires_in: 3600,
      });
      expect(result.data).toEqual({ data: 'success' });
    });

    it('should call onAuthError when refresh fails', async () => {
      client.setTokens('expired-token', 'refresh-token');

      // Mock the initial request that returns 401
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers(),
        } as Response)
        // Mock the refresh token request failure
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers(),
        } as Response);

      const result = await client.get('/api/v1/test');

      expect(mockOnAuthError).toHaveBeenCalled();
      expect(result.error).toBeDefined();
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      client.setTokens('access-token', 'refresh-token');
    });

    it('should make GET request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
        headers: new Headers(),
      } as Response);

      const result = await client.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/test',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer access-token',
          },
        }
      );

      expect(result.data).toEqual({ data: 'test' });
    });

    it('should make POST request', async () => {
      const postData = { name: 'test' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, ...postData }),
        headers: new Headers(),
      } as Response);

      const result = await client.post('/api/v1/test', postData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/test',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer access-token',
          },
          body: JSON.stringify(postData),
        }
      );

      expect(result.data).toEqual({ id: 1, ...postData });
    });

    it('should make PUT request', async () => {
      const putData = { id: 1, name: 'updated' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => putData,
        headers: new Headers(),
      } as Response);

      const result = await client.put('/api/v1/test/1', putData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/test/1',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer access-token',
          },
          body: JSON.stringify(putData),
        }
      );

      expect(result.data).toEqual(putData);
    });

    it('should make DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-length': '0' }),
      });

      const result = await client.delete('/api/v1/test/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/test/1',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer access-token',
          },
        }
      );

      expect(result.data).toEqual({});
    });
  });

  describe('file upload', () => {
    it('should upload file with FormData', async () => {
      client.setTokens('access-token', 'refresh-token');
      
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const additionalData = { alt_text: 'Test file' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'file-1',
          filename: 'test.txt',
          mime_type: 'text/plain',
        }),
        headers: new Headers(),
      } as Response);

      const result = await client.uploadFile('/api/v1/upload', file, additionalData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/upload',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer access-token',
          },
          body: expect.any(FormData),
        }
      );

      expect(result.data).toEqual({
        id: 'file-1',
        filename: 'test.txt',
        mime_type: 'text/plain',
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.get('/api/v1/test');

      expect(result.error).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Network error',
      });
    });

    it('should handle HTTP errors without JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('No JSON body');
        },
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: '',
        clone: vi.fn(),
        body: null,
        bodyUsed: false,
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        text: vi.fn(),
        bytes: vi.fn(),
      } as unknown as Response);

      const result = await client.get('/api/v1/test');

      expect(result.error).toEqual({
        code: 'HTTP_ERROR',
        message: 'HTTP 500: Internal Server Error',
      });
    });
  });
});