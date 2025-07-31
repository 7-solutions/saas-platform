import type { 
  Page, 
  PageStatus, 
  ListPagesRequest, 
  GetPageRequest, 
  ApiResponse, 
  ListPagesResponse,
  BlogPost,
  BlogCategory,
  BlogTag,
  ListBlogPostsRequest,
  ListBlogPostsResponse,
  GetBlogCategoriesResponse,
  GetBlogTagsResponse
} from '@saas-platform/shared';
import { unstable_cache } from 'next/cache';

// Server-side API client implementation (simplified)
class ServerApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    
    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add cache control for server-side requests
        next: { revalidate: 300 }, // 5 minutes
      });

      if (!response.ok) {
        return {
          error: {
            code: 'HTTP_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
        };
      }

      const data: T = await response.json();
      return { data };
    } catch (error) {
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }
}

// Server-side content service implementation
class ServerContentService {
  constructor(private client: ServerApiClient) {}

  async listPages(request: ListPagesRequest = {}): Promise<ApiResponse<ListPagesResponse>> {
    const params: Record<string, string> = {};
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.status) params.status = request.status;
    if (request.search) params.search = request.search;

    return this.client.get<ListPagesResponse>('/api/v1/pages', params);
  }

  async getPage(request: GetPageRequest): Promise<ApiResponse<Page>> {
    return this.client.get<Page>(`/api/v1/pages/${request.id}`);
  }

  async listBlogPosts(request: ListBlogPostsRequest = {}): Promise<ApiResponse<ListBlogPostsResponse>> {
    const params: Record<string, string> = {};
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.status) params.status = request.status;
    if (request.category) params.category = request.category;
    if (request.tag) params.tag = request.tag;

    return this.client.get<ListBlogPostsResponse>('/api/v1/blog', params);
  }

  async getBlogCategories(): Promise<ApiResponse<GetBlogCategoriesResponse>> {
    return this.client.get<GetBlogCategoriesResponse>('/api/v1/blog/categories');
  }

  async getBlogTags(): Promise<ApiResponse<GetBlogTagsResponse>> {
    return this.client.get<GetBlogTagsResponse>('/api/v1/blog/tags');
  }

  async searchBlogPosts(request: { query: string; page_size?: number; page_token?: string; category?: string; tag?: string }): Promise<ApiResponse<ListBlogPostsResponse>> {
    const params: Record<string, string> = { query: request.query };
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.category) params.category = request.category;
    if (request.tag) params.tag = request.tag;

    return this.client.get<ListBlogPostsResponse>('/api/v1/blog/search', params);
  }

  async getRSSFeed(): Promise<ApiResponse<{ xml_content: string }>> {
    return this.client.get<{ xml_content: string }>('/api/v1/blog/rss');
  }
}

// Create API client for server-side usage
const apiClient = new ServerApiClient(
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
);

const contentService = new ServerContentService(apiClient);

// Cache for pages to avoid repeated API calls during build
const pageCache = new Map<string, Page>();
const pagesListCache = new Map<string, Page[]>();

/**
 * Get all published pages (with Next.js caching)
 */
const getCachedPublishedPages = unstable_cache(
  async (): Promise<Page[]> => {
    try {
      const response = await contentService.listPages({
        status: 'PAGE_STATUS_PUBLISHED' as PageStatus,
        page_size: 100, // Get all published pages
      });

      if (response.error) {
        console.error('Error fetching published pages:', response.error);
        return [];
      }

      return response.data?.pages || [];
    } catch (error) {
      console.error('Error fetching published pages:', error);
      return [];
    }
  },
  ['published-pages'],
  {
    tags: ['pages', 'published-pages'],
    revalidate: 300, // 5 minutes
  }
);

/**
 * Get all published pages
 */
export async function getPublishedPages(): Promise<Page[]> {
  const cacheKey = 'published-pages';
  
  if (pagesListCache.has(cacheKey)) {
    return pagesListCache.get(cacheKey)!;
  }

  const pages = await getCachedPublishedPages();
  pagesListCache.set(cacheKey, pages);
  
  // Also cache individual pages
  pages.forEach(page => {
    pageCache.set(page.slug, page);
  });

  return pages;
}

/**
 * Get a page by its slug
 */
export async function getPageBySlug(slug: string): Promise<Page | null> {
  // Check cache first
  if (pageCache.has(slug)) {
    return pageCache.get(slug)!;
  }

  try {
    // First, try to get all published pages and find by slug
    const pages = await getPublishedPages();
    const page = pages.find(p => p.slug === slug);
    
    if (page) {
      pageCache.set(slug, page);
      return page;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching page with slug "${slug}":`, error);
    return null;
  }
}

/**
 * Get a page by its ID (with Next.js caching)
 */
const getCachedPageById = unstable_cache(
  async (id: string): Promise<Page | null> => {
    try {
      const response = await contentService.getPage({ id });

      if (response.error) {
        console.error('Error fetching page by ID:', response.error);
        return null;
      }

      return response.data || null;
    } catch (error) {
      console.error(`Error fetching page with ID "${id}":`, error);
      return null;
    }
  },
  ['page-by-id'],
  {
    tags: ['pages'],
    revalidate: 300, // 5 minutes
  }
);

/**
 * Get a page by its ID
 */
export async function getPageById(id: string): Promise<Page | null> {
  const page = await getCachedPageById(id);
  
  if (page) {
    // Cache the page
    pageCache.set(page.slug, page);
  }

  return page;
}

/**
 * Clear the page cache (useful for development)
 */
export function clearPageCache(): void {
  pageCache.clear();
  pagesListCache.clear();
}

/**
 * Get pages for sitemap generation
 */
export async function getPagesForSitemap(): Promise<Array<{ slug: string; lastModified: Date }>> {
  try {
    const pages = await getPublishedPages();
    
    return pages.map(page => ({
      slug: page.slug,
      lastModified: new Date(page.updated_at),
    }));
  } catch (error) {
    console.error('Error fetching pages for sitemap:', error);
    return [];
  }
}

/**
 * Check if a page exists by slug
 */
export async function pageExists(slug: string): Promise<boolean> {
  const page = await getPageBySlug(slug);
  return page !== null;
}

/**
 * Trigger revalidation of a specific page or all pages
 */
export async function revalidateContent(options: {
  path?: string;
  tag?: string;
}): Promise<boolean> {
  try {
    const revalidationUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/revalidate`;
    
    const response = await fetch(revalidationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...options,
        secret: process.env.REVALIDATION_SECRET,
      }),
    });

    if (!response.ok) {
      console.error('Failed to revalidate content:', response.statusText);
      return false;
    }

    const result = await response.json();
    console.log('Content revalidated:', result);
    return true;
  } catch (error) {
    console.error('Error triggering revalidation:', error);
    return false;
  }
}

/**
 * Revalidate a specific page by slug
 */
export async function revalidatePage(slug: string): Promise<boolean> {
  return revalidateContent({ path: `/${slug}` });
}

/**
 * Revalidate all pages
 */
export async function revalidateAllPages(): Promise<boolean> {
  return revalidateContent({ tag: 'pages' });
}

// Blog-related functions

/**
 * Get published blog posts with pagination and filtering
 */
export async function getPublishedBlogPosts(options: {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
} = {}): Promise<{
  posts: BlogPost[];
  hasMore: boolean;
  totalCount: number;
}> {
  const { page = 1, pageSize = 12, category, tag } = options;
  
  try {
    const request: ListBlogPostsRequest = {
      page_size: pageSize,
      page_token: page > 1 ? ((page - 1) * pageSize).toString() : undefined,
      status: 'PAGE_STATUS_PUBLISHED' as PageStatus,
      ...(category && { category }),
      ...(tag && { tag }),
    };

    const response = await contentService.listBlogPosts(request);

    if (response.error) {
      console.error('Error fetching blog posts:', response.error);
      return { posts: [], hasMore: false, totalCount: 0 };
    }

    const posts = response.data?.posts || [];
    const hasMore = !!response.data?.next_page_token;
    const totalCount = response.data?.total_count || 0;

    return { posts, hasMore, totalCount };
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return { posts: [], hasMore: false, totalCount: 0 };
  }
}

/**
 * Get a blog post by its slug
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    // First, get all published blog posts and find by slug
    const { posts } = await getPublishedBlogPosts({ pageSize: 100 });
    const post = posts.find(p => p.slug === slug);
    
    return post || null;
  } catch (error) {
    console.error(`Error fetching blog post with slug "${slug}":`, error);
    return null;
  }
}

/**
 * Get blog categories
 */
export async function getBlogCategories(): Promise<BlogCategory[]> {
  try {
    const response = await contentService.getBlogCategories();

    if (response.error) {
      console.error('Error fetching blog categories:', response.error);
      return [];
    }

    return response.data?.categories || [];
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    return [];
  }
}

/**
 * Get blog tags
 */
export async function getBlogTags(): Promise<BlogTag[]> {
  try {
    const response = await contentService.getBlogTags();

    if (response.error) {
      console.error('Error fetching blog tags:', response.error);
      return [];
    }

    return response.data?.tags || [];
  } catch (error) {
    console.error('Error fetching blog tags:', error);
    return [];
  }
}

/**
 * Search blog posts
 */
export async function searchBlogPosts(query: string, options: {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
} = {}): Promise<{
  posts: BlogPost[];
  hasMore: boolean;
  totalCount: number;
}> {
  const { page = 1, pageSize = 12, category, tag } = options;
  
  try {
    const response = await contentService.searchBlogPosts({
      query,
      page_size: pageSize,
      page_token: page > 1 ? ((page - 1) * pageSize).toString() : undefined,
      ...(category && { category }),
      ...(tag && { tag }),
    });

    if (response.error) {
      console.error('Error searching blog posts:', response.error);
      return { posts: [], hasMore: false, totalCount: 0 };
    }

    const posts = response.data?.posts || [];
    const hasMore = !!response.data?.next_page_token;
    const totalCount = response.data?.total_count || 0;

    return { posts, hasMore, totalCount };
  } catch (error) {
    console.error('Error searching blog posts:', error);
    return { posts: [], hasMore: false, totalCount: 0 };
  }
}

/**
 * Get related blog posts based on categories and tags
 */
export async function getRelatedBlogPosts(post: BlogPost, limit: number = 3): Promise<BlogPost[]> {
  try {
    const relatedPosts: BlogPost[] = [];
    const seenIds = new Set([post.id]);

    // First, try to find posts with matching categories
    if (post.categories.length > 0) {
      for (const category of post.categories) {
        if (relatedPosts.length >= limit) break;
        
        const { posts } = await getPublishedBlogPosts({ 
          category, 
          pageSize: limit * 2 
        });
        
        for (const relatedPost of posts) {
          if (relatedPosts.length >= limit) break;
          if (!seenIds.has(relatedPost.id)) {
            relatedPosts.push(relatedPost);
            seenIds.add(relatedPost.id);
          }
        }
      }
    }

    // If we still need more posts, try matching tags
    if (relatedPosts.length < limit && post.tags.length > 0) {
      for (const tag of post.tags) {
        if (relatedPosts.length >= limit) break;
        
        const { posts } = await getPublishedBlogPosts({ 
          tag, 
          pageSize: limit * 2 
        });
        
        for (const relatedPost of posts) {
          if (relatedPosts.length >= limit) break;
          if (!seenIds.has(relatedPost.id)) {
            relatedPosts.push(relatedPost);
            seenIds.add(relatedPost.id);
          }
        }
      }
    }

    // If we still need more posts, get recent posts
    if (relatedPosts.length < limit) {
      const { posts } = await getPublishedBlogPosts({ pageSize: limit * 2 });
      
      for (const recentPost of posts) {
        if (relatedPosts.length >= limit) break;
        if (!seenIds.has(recentPost.id)) {
          relatedPosts.push(recentPost);
          seenIds.add(recentPost.id);
        }
      }
    }

    return relatedPosts.slice(0, limit);
  } catch (error) {
    console.error('Error fetching related blog posts:', error);
    return [];
  }
}

/**
 * Get RSS feed for blog posts
 */
export async function getBlogRSSFeed(): Promise<string> {
  try {
    const response = await contentService.getRSSFeed();

    if (response.error) {
      console.error('Error fetching RSS feed:', response.error);
      return '';
    }

    return response.data?.xml_content || '';
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    return '';
  }
}