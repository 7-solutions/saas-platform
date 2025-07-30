import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentService } from '../content';
import { PageStatus } from '../types';
// Mock ApiClient
vi.mock('../client');
describe('ContentService', () => {
    let contentService;
    let mockApiClient;
    beforeEach(() => {
        mockApiClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };
        contentService = new ContentService(mockApiClient);
    });
    describe('createPage', () => {
        it('should create a page', async () => {
            const request = {
                title: 'Test Page',
                slug: 'test-page',
                content: { blocks: [] },
                meta: { title: 'Test Page', description: 'A test page', keywords: [] },
                status: PageStatus.DRAFT,
            };
            const expectedPage = {
                id: 'page-1',
                ...request,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };
            mockApiClient.post.mockResolvedValueOnce({ data: expectedPage });
            const result = await contentService.createPage(request);
            expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/pages', request);
            expect(result.data).toEqual(expectedPage);
        });
    });
    describe('getPage', () => {
        it('should get a page by ID', async () => {
            const pageId = 'page-1';
            const expectedPage = {
                id: pageId,
                title: 'Test Page',
                slug: 'test-page',
                content: { blocks: [] },
                meta: { title: 'Test Page', description: 'A test page', keywords: [] },
                status: PageStatus.PUBLISHED,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };
            mockApiClient.get.mockResolvedValueOnce({ data: expectedPage });
            const result = await contentService.getPage({ id: pageId });
            expect(mockApiClient.get).toHaveBeenCalledWith(`/api/v1/pages/${pageId}`);
            expect(result.data).toEqual(expectedPage);
        });
    });
    describe('updatePage', () => {
        it('should update a page', async () => {
            const updateRequest = {
                id: 'page-1',
                title: 'Updated Page',
                slug: 'updated-page',
                content: { blocks: [] },
                meta: { title: 'Updated Page', description: 'An updated page', keywords: [] },
                status: 'PAGE_STATUS_PUBLISHED',
            };
            const expectedPage = {
                ...updateRequest,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T01:00:00Z',
            };
            mockApiClient.put.mockResolvedValueOnce({ data: expectedPage });
            const result = await contentService.updatePage(updateRequest);
            const { id, ...updateData } = updateRequest;
            expect(mockApiClient.put).toHaveBeenCalledWith(`/api/v1/pages/${id}`, updateData);
            expect(result.data).toEqual(expectedPage);
        });
    });
    describe('deletePage', () => {
        it('should delete a page', async () => {
            const pageId = 'page-1';
            mockApiClient.delete.mockResolvedValueOnce({ data: undefined });
            const result = await contentService.deletePage({ id: pageId });
            expect(mockApiClient.delete).toHaveBeenCalledWith(`/api/v1/pages/${pageId}`);
            expect(result.data).toBeUndefined();
        });
    });
    describe('listPages', () => {
        it('should list pages with default parameters', async () => {
            const expectedResponse = {
                pages: [],
                next_page_token: '',
                total_count: 0,
            };
            mockApiClient.get.mockResolvedValueOnce({ data: expectedResponse });
            const result = await contentService.listPages();
            expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/pages', {});
            expect(result.data).toEqual(expectedResponse);
        });
        it('should list pages with filters', async () => {
            const request = {
                page_size: 10,
                page_token: 'token-123',
                status: PageStatus.PUBLISHED,
                search: 'test',
            };
            const expectedResponse = {
                pages: [],
                next_page_token: 'next-token',
                total_count: 5,
            };
            mockApiClient.get.mockResolvedValueOnce({ data: expectedResponse });
            const result = await contentService.listPages(request);
            expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/pages', {
                page_size: '10',
                page_token: 'token-123',
                status: PageStatus.PUBLISHED,
                search: 'test',
            });
            expect(result.data).toEqual(expectedResponse);
        });
    });
});
