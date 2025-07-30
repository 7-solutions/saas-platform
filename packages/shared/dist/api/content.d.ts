import type { ApiClient } from './client';
import type { ApiResponse, Page, CreatePageRequest, GetPageRequest, UpdatePageRequest, DeletePageRequest, ListPagesRequest, ListPagesResponse, BlogPost, CreateBlogPostRequest, GetBlogPostRequest, UpdateBlogPostRequest, DeleteBlogPostRequest, ListBlogPostsRequest, ListBlogPostsResponse, SearchBlogPostsRequest, SearchBlogPostsResponse, GetBlogCategoriesRequest, GetBlogCategoriesResponse, GetBlogTagsRequest, GetBlogTagsResponse, GetRSSFeedRequest, GetRSSFeedResponse } from './types';
export declare class ContentService {
    private client;
    constructor(client: ApiClient);
    createPage(request: CreatePageRequest): Promise<ApiResponse<Page>>;
    getPage(request: GetPageRequest): Promise<ApiResponse<Page>>;
    updatePage(request: UpdatePageRequest): Promise<ApiResponse<Page>>;
    deletePage(request: DeletePageRequest): Promise<ApiResponse<void>>;
    listPages(request?: ListPagesRequest): Promise<ApiResponse<ListPagesResponse>>;
    createBlogPost(request: CreateBlogPostRequest): Promise<ApiResponse<BlogPost>>;
    getBlogPost(request: GetBlogPostRequest): Promise<ApiResponse<BlogPost>>;
    updateBlogPost(request: UpdateBlogPostRequest): Promise<ApiResponse<BlogPost>>;
    deleteBlogPost(request: DeleteBlogPostRequest): Promise<ApiResponse<void>>;
    listBlogPosts(request?: ListBlogPostsRequest): Promise<ApiResponse<ListBlogPostsResponse>>;
    searchBlogPosts(request: SearchBlogPostsRequest): Promise<ApiResponse<SearchBlogPostsResponse>>;
    getBlogCategories(request?: GetBlogCategoriesRequest): Promise<ApiResponse<GetBlogCategoriesResponse>>;
    getBlogTags(request?: GetBlogTagsRequest): Promise<ApiResponse<GetBlogTagsResponse>>;
    getRSSFeed(request?: GetRSSFeedRequest): Promise<ApiResponse<GetRSSFeedResponse>>;
}
//# sourceMappingURL=content.d.ts.map