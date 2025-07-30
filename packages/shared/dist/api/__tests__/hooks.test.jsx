import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { setApiClient, useLogin, usePages, useCreatePage, useUploadFile } from '../hooks';
import { UserRole, PageStatus } from '../types';
// Mock ApiClient
vi.mock('../client');
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    return ({ children }) => (<QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>);
};
describe('API Hooks', () => {
    let mockApiClient;
    beforeEach(() => {
        mockApiClient = {
            login: vi.fn(),
            get: vi.fn(),
            post: vi.fn(),
            uploadFile: vi.fn(),
        };
        setApiClient(mockApiClient);
    });
    describe('useLogin', () => {
        it('should handle successful login', async () => {
            const loginRequest = {
                email: 'test@example.com',
                password: 'password123',
            };
            const loginResponse = {
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
            mockApiClient.login.mockResolvedValueOnce({ data: loginResponse });
            const { result } = renderHook(() => useLogin(), {
                wrapper: createWrapper(),
            });
            result.current.mutate(loginRequest);
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(mockApiClient.login).toHaveBeenCalledWith(loginRequest);
            expect(result.current.data?.data).toEqual(loginResponse);
        });
        it('should handle login error', async () => {
            const loginRequest = {
                email: 'test@example.com',
                password: 'wrong-password',
            };
            mockApiClient.login.mockResolvedValueOnce({
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password',
                },
            });
            const { result } = renderHook(() => useLogin(), {
                wrapper: createWrapper(),
            });
            result.current.mutate(loginRequest);
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(result.current.data?.error).toEqual({
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
            });
        });
    });
    describe('usePages', () => {
        it('should fetch pages list', async () => {
            const pagesResponse = {
                pages: [
                    {
                        id: 'page-1',
                        title: 'Test Page',
                        slug: 'test-page',
                        content: { blocks: [] },
                        meta: { title: 'Test Page', description: 'A test page', keywords: [] },
                        status: PageStatus.PUBLISHED,
                        created_at: '2024-01-01T00:00:00Z',
                        updated_at: '2024-01-01T00:00:00Z',
                    },
                ],
                next_page_token: '',
                total_count: 1,
            };
            // Mock the content service call through the client
            mockApiClient.get.mockResolvedValueOnce({ data: pagesResponse });
            const { result } = renderHook(() => usePages(), {
                wrapper: createWrapper(),
            });
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(result.current.data?.data).toEqual(pagesResponse);
        });
        it('should fetch pages with filters', async () => {
            const request = {
                status: PageStatus.DRAFT,
                search: 'test',
            };
            const pagesResponse = {
                pages: [],
                next_page_token: '',
                total_count: 0,
            };
            mockApiClient.get.mockResolvedValueOnce({ data: pagesResponse });
            const { result } = renderHook(() => usePages(request), {
                wrapper: createWrapper(),
            });
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(result.current.data?.data).toEqual(pagesResponse);
        });
    });
    describe('useCreatePage', () => {
        it('should create a page', async () => {
            const createRequest = {
                title: 'New Page',
                slug: 'new-page',
                content: { blocks: [] },
                meta: { title: 'New Page', description: 'A new page', keywords: [] },
                status: PageStatus.DRAFT,
            };
            const createdPage = {
                id: 'page-2',
                ...createRequest,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };
            mockApiClient.post.mockResolvedValueOnce({ data: createdPage });
            const { result } = renderHook(() => useCreatePage(), {
                wrapper: createWrapper(),
            });
            result.current.mutate(createRequest);
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/pages', createRequest);
            expect(result.current.data?.data).toEqual(createdPage);
        });
    });
    describe('useUploadFile', () => {
        it('should upload a file', async () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            const altText = 'Test file';
            const uploadedFile = {
                id: 'file-1',
                filename: 'test.txt',
                original_name: 'test.txt',
                mime_type: 'text/plain',
                size: 12,
                url: '/uploads/test.txt',
                alt_text: altText,
                uploaded_by: 'user-1',
                created_at: '2024-01-01T00:00:00Z',
            };
            mockApiClient.uploadFile.mockResolvedValueOnce({ data: uploadedFile });
            const { result } = renderHook(() => useUploadFile(), {
                wrapper: createWrapper(),
            });
            result.current.mutate({ file, altText });
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(mockApiClient.uploadFile).toHaveBeenCalledWith('/api/v1/media/upload', file, { alt_text: altText });
            expect(result.current.data?.data).toEqual(uploadedFile);
        });
    });
});
