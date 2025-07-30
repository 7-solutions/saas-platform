import type { ApiClient } from './client';
import type {
  ApiResponse,
  Page,
  CreatePageRequest,
  GetPageRequest,
  UpdatePageRequest,
  DeletePageRequest,
  ListPagesRequest,
  ListPagesResponse,
  BlogPost,
  CreateBlogPostRequest,
  GetBlogPostRequest,
  UpdateBlogPostRequest,
  DeleteBlogPostRequest,
  ListBlogPostsRequest,
  ListBlogPostsResponse,
  SearchBlogPostsRequest,
  SearchBlogPostsResponse,
  GetBlogCategoriesRequest,
  GetBlogCategoriesResponse,
  GetBlogTagsRequest,
  GetBlogTagsResponse,
  GetRSSFeedRequest,
  GetRSSFeedResponse,
} from './types';

export class ContentService {
  constructor(private client: ApiClient) {}

  async createPage(request: CreatePageRequest): Promise<ApiResponse<Page>> {
    return this.client.post<Page>('/api/v1/pages', request);
  }

  async getPage(request: GetPageRequest): Promise<ApiResponse<Page>> {
    return this.client.get<Page>(`/api/v1/pages/${request.id}`);
  }

  async updatePage(request: UpdatePageRequest): Promise<ApiResponse<Page>> {
    const { id, ...updateData } = request;
    return this.client.put<Page>(`/api/v1/pages/${id}`, updateData);
  }

  async deletePage(request: DeletePageRequest): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/api/v1/pages/${request.id}`);
  }

  async listPages(request: ListPagesRequest = {}): Promise<ApiResponse<ListPagesResponse>> {
    const params: Record<string, string> = {};
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.status) params.status = request.status;
    if (request.search) params.search = request.search;

    return this.client.get<ListPagesResponse>('/api/v1/pages', params);
  }

  // Blog post methods
  async createBlogPost(request: CreateBlogPostRequest): Promise<ApiResponse<BlogPost>> {
    return this.client.post<BlogPost>('/api/v1/blog', request);
  }

  async getBlogPost(request: GetBlogPostRequest): Promise<ApiResponse<BlogPost>> {
    return this.client.get<BlogPost>(`/api/v1/blog/${request.id}`);
  }

  async updateBlogPost(request: UpdateBlogPostRequest): Promise<ApiResponse<BlogPost>> {
    const { id, ...updateData } = request;
    return this.client.put<BlogPost>(`/api/v1/blog/${id}`, updateData);
  }

  async deleteBlogPost(request: DeleteBlogPostRequest): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/api/v1/blog/${request.id}`);
  }

  async listBlogPosts(request: ListBlogPostsRequest = {}): Promise<ApiResponse<ListBlogPostsResponse>> {
    const params: Record<string, string> = {};
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.status) params.status = request.status;
    if (request.category) params.category = request.category;
    if (request.tag) params.tag = request.tag;
    if (request.author) params.author = request.author;

    return this.client.get<ListBlogPostsResponse>('/api/v1/blog', params);
  }

  async searchBlogPosts(request: SearchBlogPostsRequest): Promise<ApiResponse<SearchBlogPostsResponse>> {
    const params: Record<string, string> = {
      query: request.query,
    };
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.category) params.category = request.category;
    if (request.tag) params.tag = request.tag;

    return this.client.get<SearchBlogPostsResponse>('/api/v1/blog/search', params);
  }

  async getBlogCategories(request: GetBlogCategoriesRequest = {}): Promise<ApiResponse<GetBlogCategoriesResponse>> {
    return this.client.get<GetBlogCategoriesResponse>('/api/v1/blog/categories');
  }

  async getBlogTags(request: GetBlogTagsRequest = {}): Promise<ApiResponse<GetBlogTagsResponse>> {
    return this.client.get<GetBlogTagsResponse>('/api/v1/blog/tags');
  }

  async getRSSFeed(request: GetRSSFeedRequest = {}): Promise<ApiResponse<GetRSSFeedResponse>> {
    return this.client.get<GetRSSFeedResponse>('/api/v1/blog/rss');
  }
}