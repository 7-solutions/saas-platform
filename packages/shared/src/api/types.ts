// API types generated from protobuf definitions

// Auth types
export interface User {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  created_at: string;
  last_login?: string;
}

export interface UserProfile {
  name: string;
  avatar?: string;
}

export enum UserRole {
  UNSPECIFIED = 'USER_ROLE_UNSPECIFIED',
  ADMIN = 'USER_ROLE_ADMIN',
  EDITOR = 'USER_ROLE_EDITOR',
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  expires_in: number;
}

export interface ValidateTokenRequest {
  token: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  token: string;
}

export interface LogoutResponse {
  success: boolean;
}

// Content types
export interface Page {
  id: string;
  title: string;
  slug: string;
  content: PageContent;
  meta: PageMeta;
  status: PageStatus;
  created_at: string;
  updated_at: string;
}

export interface PageContent {
  blocks: ContentBlock[];
}

export interface ContentBlock {
  type: string;
  data: Record<string, string>;
}

export interface PageMeta {
  title: string;
  description: string;
  keywords: string[];
}

export enum PageStatus {
  UNSPECIFIED = 'PAGE_STATUS_UNSPECIFIED',
  DRAFT = 'PAGE_STATUS_DRAFT',
  PUBLISHED = 'PAGE_STATUS_PUBLISHED',
  ARCHIVED = 'PAGE_STATUS_ARCHIVED',
}

export interface CreatePageRequest {
  title: string;
  slug: string;
  content: PageContent;
  meta: PageMeta;
  status: PageStatus;
}

export interface GetPageRequest {
  id: string;
}

export interface UpdatePageRequest {
  id: string;
  title: string;
  slug: string;
  content: PageContent;
  meta: PageMeta;
  status: PageStatus;
}

export interface DeletePageRequest {
  id: string;
}

export interface ListPagesRequest {
  page_size?: number;
  page_token?: string;
  status?: PageStatus;
  search?: string;
}

export interface ListPagesResponse {
  pages: Page[];
  next_page_token: string;
  total_count: number;
}

// Blog types
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: PageContent;
  meta: PageMeta;
  status: PageStatus;
  author: string;
  categories: string[];
  tags: string[];
  featured_image?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBlogPostRequest {
  title: string;
  slug?: string;
  excerpt: string;
  content: PageContent;
  meta: PageMeta;
  status: PageStatus;
  author: string;
  categories: string[];
  tags: string[];
  featured_image?: string;
  published_at?: string;
}

export interface GetBlogPostRequest {
  id: string;
}

export interface UpdateBlogPostRequest {
  id: string;
  title: string;
  slug?: string;
  excerpt: string;
  content: PageContent;
  meta: PageMeta;
  status: PageStatus;
  author: string;
  categories: string[];
  tags: string[];
  featured_image?: string;
  published_at?: string;
}

export interface DeleteBlogPostRequest {
  id: string;
}

export interface ListBlogPostsRequest {
  page_size?: number;
  page_token?: string;
  status?: PageStatus;
  category?: string;
  tag?: string;
  author?: string;
}

export interface ListBlogPostsResponse {
  posts: BlogPost[];
  next_page_token: string;
  total_count: number;
}

export interface SearchBlogPostsRequest {
  query: string;
  page_size?: number;
  page_token?: string;
  category?: string;
  tag?: string;
}

export interface SearchBlogPostsResponse {
  posts: BlogPost[];
  next_page_token: string;
  total_count: number;
}

export interface GetBlogCategoriesRequest {}

export interface GetBlogCategoriesResponse {
  categories: BlogCategory[];
}

export interface BlogCategory {
  name: string;
  slug: string;
  post_count: number;
}

export interface GetBlogTagsRequest {}

export interface GetBlogTagsResponse {
  tags: BlogTag[];
}

export interface BlogTag {
  name: string;
  slug: string;
  post_count: number;
}

export interface GetRSSFeedRequest {}

export interface GetRSSFeedResponse {
  xml_content: string;
  content_type: string;
}

// Media types
export interface MediaFile {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  alt_text?: string;
  uploaded_by: string;
  created_at: string;
}

export interface UploadFileRequest {
  content: Uint8Array;
  filename: string;
  mime_type: string;
  alt_text?: string;
}

export interface GetFileRequest {
  id: string;
}

export interface DeleteFileRequest {
  id: string;
}

export interface ListFilesRequest {
  page_size?: number;
  page_token?: string;
  mime_type_filter?: string;
  search?: string;
}

export interface ListFilesResponse {
  files: MediaFile[];
  next_page_token: string;
  total_count: number;
}

export interface UpdateFileRequest {
  id: string;
  alt_text?: string;
  filename?: string;
}

// Contact types
export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  company?: string;
  message: string;
  ip_address?: string;
  user_agent?: string;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
}

export enum ContactStatus {
  UNSPECIFIED = 'CONTACT_STATUS_UNSPECIFIED',
  NEW = 'CONTACT_STATUS_NEW',
  READ = 'CONTACT_STATUS_READ',
  REPLIED = 'CONTACT_STATUS_REPLIED',
  SPAM = 'CONTACT_STATUS_SPAM',
}

export interface SubmitContactFormRequest {
  name: string;
  email: string;
  company?: string;
  message: string;
  captcha_token?: string;
}

export interface ListContactSubmissionsRequest {
  page_size?: number;
  page_token?: string;
  status?: ContactStatus;
  search?: string;
}

export interface ListContactSubmissionsResponse {
  submissions: ContactSubmission[];
  next_page_token?: string;
  total_count: number;
}

export interface GetContactSubmissionRequest {
  id: string;
}

export interface MarkContactSubmissionAsReadRequest {
  id: string;
}

export interface DeleteContactSubmissionRequest {
  id: string;
}

// Common API types
export interface ApiError {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}