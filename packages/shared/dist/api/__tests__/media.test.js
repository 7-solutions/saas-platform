import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from '../media';
// Mock ApiClient
vi.mock('../client');
describe('MediaService', () => {
    let mediaService;
    let mockApiClient;
    beforeEach(() => {
        mockApiClient = {
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            uploadFile: vi.fn(),
        };
        mediaService = new MediaService(mockApiClient);
    });
    describe('uploadFile', () => {
        it('should upload a file', async () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            const altText = 'Test file';
            const expectedFile = {
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
            mockApiClient.uploadFile.mockResolvedValueOnce({ data: expectedFile });
            const result = await mediaService.uploadFile(file, altText);
            expect(mockApiClient.uploadFile).toHaveBeenCalledWith('/api/v1/media/upload', file, { alt_text: altText });
            expect(result.data).toEqual(expectedFile);
        });
        it('should upload a file without alt text', async () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            const expectedFile = {
                id: 'file-1',
                filename: 'test.txt',
                original_name: 'test.txt',
                mime_type: 'text/plain',
                size: 12,
                url: '/uploads/test.txt',
                uploaded_by: 'user-1',
                created_at: '2024-01-01T00:00:00Z',
            };
            mockApiClient.uploadFile.mockResolvedValueOnce({ data: expectedFile });
            const result = await mediaService.uploadFile(file);
            expect(mockApiClient.uploadFile).toHaveBeenCalledWith('/api/v1/media/upload', file, {});
            expect(result.data).toEqual(expectedFile);
        });
    });
    describe('getFile', () => {
        it('should get a file by ID', async () => {
            const fileId = 'file-1';
            const expectedFile = {
                id: fileId,
                filename: 'test.txt',
                original_name: 'test.txt',
                mime_type: 'text/plain',
                size: 12,
                url: '/uploads/test.txt',
                uploaded_by: 'user-1',
                created_at: '2024-01-01T00:00:00Z',
            };
            mockApiClient.get.mockResolvedValueOnce({ data: expectedFile });
            const result = await mediaService.getFile({ id: fileId });
            expect(mockApiClient.get).toHaveBeenCalledWith(`/api/v1/media/${fileId}`);
            expect(result.data).toEqual(expectedFile);
        });
    });
    describe('deleteFile', () => {
        it('should delete a file', async () => {
            const fileId = 'file-1';
            mockApiClient.delete.mockResolvedValueOnce({ data: undefined });
            const result = await mediaService.deleteFile({ id: fileId });
            expect(mockApiClient.delete).toHaveBeenCalledWith(`/api/v1/media/${fileId}`);
            expect(result.data).toBeUndefined();
        });
    });
    describe('listFiles', () => {
        it('should list files with default parameters', async () => {
            const expectedResponse = {
                files: [],
                next_page_token: '',
                total_count: 0,
            };
            mockApiClient.get.mockResolvedValueOnce({ data: expectedResponse });
            const result = await mediaService.listFiles();
            expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/media', {});
            expect(result.data).toEqual(expectedResponse);
        });
        it('should list files with filters', async () => {
            const request = {
                page_size: 20,
                page_token: 'token-456',
                mime_type_filter: 'image/',
                search: 'photo',
            };
            const expectedResponse = {
                files: [],
                next_page_token: 'next-token',
                total_count: 10,
            };
            mockApiClient.get.mockResolvedValueOnce({ data: expectedResponse });
            const result = await mediaService.listFiles(request);
            expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/media', {
                page_size: '20',
                page_token: 'token-456',
                mime_type_filter: 'image/',
                search: 'photo',
            });
            expect(result.data).toEqual(expectedResponse);
        });
    });
    describe('updateFile', () => {
        it('should update file metadata', async () => {
            const updateRequest = {
                id: 'file-1',
                alt_text: 'Updated alt text',
                filename: 'updated-file.txt',
            };
            const expectedFile = {
                id: 'file-1',
                filename: 'updated-file.txt',
                original_name: 'test.txt',
                mime_type: 'text/plain',
                size: 12,
                url: '/uploads/updated-file.txt',
                alt_text: 'Updated alt text',
                uploaded_by: 'user-1',
                created_at: '2024-01-01T00:00:00Z',
            };
            mockApiClient.put.mockResolvedValueOnce({ data: expectedFile });
            const result = await mediaService.updateFile(updateRequest);
            const { id, ...updateData } = updateRequest;
            expect(mockApiClient.put).toHaveBeenCalledWith(`/api/v1/media/${id}`, updateData);
            expect(result.data).toEqual(expectedFile);
        });
    });
});
