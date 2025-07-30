import { useMutation, useQuery, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import type { ApiClient } from './client';
import { ContentService } from './content';
import { ContactService } from './contact';
import { MediaService } from './media';
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  User,
  Page,
  CreatePageRequest,
  UpdatePageRequest,
  ListPagesRequest,
  ListPagesResponse,
  MediaFile,
  ListFilesRequest,
  ListFilesResponse,
  UpdateFileRequest,
  ContactSubmission,
  SubmitContactFormRequest,
  ListContactSubmissionsRequest,
  ListContactSubmissionsResponse,
} from './types';
import { PageStatus } from './types';

// Query keys for React Query
export const queryKeys = {
  auth: {
    user: ['auth', 'user'] as const,
  },
  pages: {
    all: ['pages'] as const,
    lists: () => [...queryKeys.pages.all, 'list'] as const,
    list: (filters: ListPagesRequest) => [...queryKeys.pages.lists(), filters] as const,
    details: () => [...queryKeys.pages.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.pages.details(), id] as const,
  },
  media: {
    all: ['media'] as const,
    lists: () => [...queryKeys.media.all, 'list'] as const,
    list: (filters: ListFilesRequest) => [...queryKeys.media.lists(), filters] as const,
    details: () => [...queryKeys.media.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.media.details(), id] as const,
  },
  contact: {
    all: ['contact'] as const,
    submissions: () => [...queryKeys.contact.all, 'submissions'] as const,
    submissionsList: (filters: ListContactSubmissionsRequest) => [...queryKeys.contact.submissions(), filters] as const,
    submissionDetails: () => [...queryKeys.contact.all, 'submission'] as const,
    submissionDetail: (id: string) => [...queryKeys.contact.submissionDetails(), id] as const,
  },
} as const;

// Hook context for API client
let apiClient: ApiClient | null = null;
let contentService: ContentService | null = null;
let contactService: ContactService | null = null;
let mediaService: MediaService | null = null;

export function setApiClient(client: ApiClient) {
  apiClient = client;
  contentService = new ContentService(client);
  contactService = new ContactService(client);
  mediaService = new MediaService(client);
}

function getApiClient(): ApiClient {
  if (!apiClient) {
    throw new Error('API client not initialized. Call setApiClient() first.');
  }
  return apiClient;
}

function getContentService(): ContentService {
  if (!contentService) {
    throw new Error('Content service not initialized. Call setApiClient() first.');
  }
  return contentService;
}

function getContactService(): ContactService {
  if (!contactService) {
    throw new Error('Contact service not initialized. Call setApiClient() first.');
  }
  return contactService;
}

function getMediaService(): MediaService {
  if (!mediaService) {
    throw new Error('Media service not initialized. Call setApiClient() first.');
  }
  return mediaService;
}

// Auth hooks
export function useLogin(
  options?: UseMutationOptions<ApiResponse<LoginResponse>, Error, LoginRequest>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: LoginRequest) => {
      const client = getApiClient();
      return client.login(request);
    },
    onSuccess: (data) => {
      if (data.data) {
        // Invalidate and refetch user data
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.user });
      }
    },
    ...options,
  });
}

export function useLogout(
  options?: UseMutationOptions<ApiResponse<{ success: boolean }>, Error, void>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const client = getApiClient();
      return client.logout({ token: '' }); // Token will be added by client
    },
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
    ...options,
  });
}

// Page hooks
export function usePages(
  request: ListPagesRequest = {},
  options?: UseQueryOptions<ApiResponse<ListPagesResponse>, Error>
) {
  return useQuery({
    queryKey: queryKeys.pages.list(request),
    queryFn: async () => {
      const service = getContentService();
      return service.listPages(request);
    },
    ...options,
  });
}

export function usePage(
  id: string,
  options?: UseQueryOptions<ApiResponse<Page>, Error>
) {
  return useQuery({
    queryKey: queryKeys.pages.detail(id),
    queryFn: async () => {
      const service = getContentService();
      return service.getPage({ id });
    },
    enabled: !!id,
    ...options,
  });
}

export function useCreatePage(
  options?: UseMutationOptions<ApiResponse<Page>, Error, CreatePageRequest>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: CreatePageRequest) => {
      const service = getContentService();
      return service.createPage(request);
    },
    onSuccess: () => {
      // Invalidate pages list
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.lists() });
    },
    ...options,
  });
}

export function useUpdatePage(
  options?: UseMutationOptions<ApiResponse<Page>, Error, UpdatePageRequest>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: UpdatePageRequest) => {
      const service = getContentService();
      return service.updatePage(request);
    },
    onSuccess: (data, variables) => {
      // Invalidate and update specific page
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.lists() });
    },
    ...options,
  });
}

export function useDeletePage(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const service = getContentService();
      return service.deletePage({ id });
    },
    onSuccess: (data, id) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: queryKeys.pages.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.lists() });
    },
    ...options,
  });
}

// Media hooks
export function useMediaFiles(
  request: ListFilesRequest = {},
  options?: UseQueryOptions<ApiResponse<ListFilesResponse>, Error>
) {
  return useQuery({
    queryKey: queryKeys.media.list(request),
    queryFn: async () => {
      const service = getMediaService();
      return service.listFiles(request);
    },
    ...options,
  });
}

export function useMediaFile(
  id: string,
  options?: UseQueryOptions<ApiResponse<MediaFile>, Error>
) {
  return useQuery({
    queryKey: queryKeys.media.detail(id),
    queryFn: async () => {
      const service = getMediaService();
      return service.getFile({ id });
    },
    enabled: !!id,
    ...options,
  });
}

export function useUploadFile(
  options?: UseMutationOptions<ApiResponse<MediaFile>, Error, { file: File; altText?: string }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ file, altText }) => {
      const service = getMediaService();
      return service.uploadFile(file, altText);
    },
    onSuccess: () => {
      // Invalidate media lists
      queryClient.invalidateQueries({ queryKey: queryKeys.media.lists() });
    },
    ...options,
  });
}

export function useUpdateMediaFile(
  options?: UseMutationOptions<ApiResponse<MediaFile>, Error, UpdateFileRequest>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: UpdateFileRequest) => {
      const service = getMediaService();
      return service.updateFile(request);
    },
    onSuccess: (data, variables) => {
      // Invalidate and update specific file
      queryClient.invalidateQueries({ queryKey: queryKeys.media.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.media.lists() });
    },
    ...options,
  });
}

export function useDeleteMediaFile(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const service = getMediaService();
      return service.deleteFile({ id });
    },
    onSuccess: (data, id) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: queryKeys.media.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.media.lists() });
    },
    ...options,
  });
}

// Utility hooks for common patterns
export function usePublishedPages(options?: UseQueryOptions<ApiResponse<ListPagesResponse>, Error>) {
  return usePages(
    { status: PageStatus.PUBLISHED },
    options
  );
}

export function useDraftPages(options?: UseQueryOptions<ApiResponse<ListPagesResponse>, Error>) {
  return usePages(
    { status: PageStatus.DRAFT },
    options
  );
}

export function useImageFiles(options?: UseQueryOptions<ApiResponse<ListFilesResponse>, Error>) {
  return useMediaFiles(
    { mime_type_filter: 'image/' },
    options
  );
}

// Additional utility hooks for better developer experience
export function useCurrentUser(
  options?: UseQueryOptions<ApiResponse<User>, Error>
) {
  return useQuery({
    queryKey: queryKeys.auth.user,
    queryFn: async () => {
      const client = getApiClient();
      // This would typically validate the current token and return user info
      return client.validateToken({ token: '' }); // Token will be added by client
    },
    ...options,
  });
}

// Hook for invalidating all queries (useful for logout)
export function useInvalidateAllQueries() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.clear();
  };
}

// Simple service hooks for direct API access
export function useContentApi() {
  return getContentService();
}

export function useMediaApi() {
  return getMediaService();
}

// Contact hooks
export function useSubmitContactForm(
  options?: UseMutationOptions<ApiResponse<ContactSubmission>, Error, SubmitContactFormRequest>
) {
  return useMutation({
    mutationFn: async (request: SubmitContactFormRequest) => {
      const service = getContactService();
      return service.submitContactForm(request);
    },
    ...options,
  });
}

export function useContactSubmissions(
  request: ListContactSubmissionsRequest = {},
  options?: UseQueryOptions<ApiResponse<ListContactSubmissionsResponse>, Error>
) {
  return useQuery({
    queryKey: queryKeys.contact.submissionsList(request),
    queryFn: async () => {
      const service = getContactService();
      return service.listContactSubmissions(request);
    },
    ...options,
  });
}

export function useContactSubmission(
  id: string,
  options?: UseQueryOptions<ApiResponse<ContactSubmission>, Error>
) {
  return useQuery({
    queryKey: queryKeys.contact.submissionDetail(id),
    queryFn: async () => {
      const service = getContactService();
      return service.getContactSubmission({ id });
    },
    enabled: !!id,
    ...options,
  });
}

export function useMarkContactSubmissionAsRead(
  options?: UseMutationOptions<ApiResponse<ContactSubmission>, Error, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const service = getContactService();
      return service.markContactSubmissionAsRead({ id });
    },
    onSuccess: (data, id) => {
      // Invalidate and update specific submission
      queryClient.invalidateQueries({ queryKey: queryKeys.contact.submissionDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contact.submissions() });
    },
    ...options,
  });
}

export function useDeleteContactSubmission(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const service = getContactService();
      return service.deleteContactSubmission({ id });
    },
    onSuccess: (data, id) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: queryKeys.contact.submissionDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contact.submissions() });
    },
    ...options,
  });
}

export function useContactApi() {
  return getContactService();
}