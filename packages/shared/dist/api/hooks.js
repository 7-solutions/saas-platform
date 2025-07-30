import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContentService } from './content';
import { ContactService } from './contact';
import { MediaService } from './media';
import { PageStatus } from './types';
// Query keys for React Query
export const queryKeys = {
    auth: {
        user: ['auth', 'user'],
    },
    pages: {
        all: ['pages'],
        lists: () => [...queryKeys.pages.all, 'list'],
        list: (filters) => [...queryKeys.pages.lists(), filters],
        details: () => [...queryKeys.pages.all, 'detail'],
        detail: (id) => [...queryKeys.pages.details(), id],
    },
    media: {
        all: ['media'],
        lists: () => [...queryKeys.media.all, 'list'],
        list: (filters) => [...queryKeys.media.lists(), filters],
        details: () => [...queryKeys.media.all, 'detail'],
        detail: (id) => [...queryKeys.media.details(), id],
    },
    contact: {
        all: ['contact'],
        submissions: () => [...queryKeys.contact.all, 'submissions'],
        submissionsList: (filters) => [...queryKeys.contact.submissions(), filters],
        submissionDetails: () => [...queryKeys.contact.all, 'submission'],
        submissionDetail: (id) => [...queryKeys.contact.submissionDetails(), id],
    },
};
// Hook context for API client
let apiClient = null;
let contentService = null;
let contactService = null;
let mediaService = null;
export function setApiClient(client) {
    apiClient = client;
    contentService = new ContentService(client);
    contactService = new ContactService(client);
    mediaService = new MediaService(client);
}
function getApiClient() {
    if (!apiClient) {
        throw new Error('API client not initialized. Call setApiClient() first.');
    }
    return apiClient;
}
function getContentService() {
    if (!contentService) {
        throw new Error('Content service not initialized. Call setApiClient() first.');
    }
    return contentService;
}
function getContactService() {
    if (!contactService) {
        throw new Error('Contact service not initialized. Call setApiClient() first.');
    }
    return contactService;
}
function getMediaService() {
    if (!mediaService) {
        throw new Error('Media service not initialized. Call setApiClient() first.');
    }
    return mediaService;
}
// Auth hooks
export function useLogin(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (request) => {
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
export function useLogout(options) {
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
export function usePages(request = {}, options) {
    return useQuery({
        queryKey: queryKeys.pages.list(request),
        queryFn: async () => {
            const service = getContentService();
            return service.listPages(request);
        },
        ...options,
    });
}
export function usePage(id, options) {
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
export function useCreatePage(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (request) => {
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
export function useUpdatePage(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (request) => {
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
export function useDeletePage(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
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
export function useMediaFiles(request = {}, options) {
    return useQuery({
        queryKey: queryKeys.media.list(request),
        queryFn: async () => {
            const service = getMediaService();
            return service.listFiles(request);
        },
        ...options,
    });
}
export function useMediaFile(id, options) {
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
export function useUploadFile(options) {
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
export function useUpdateMediaFile(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (request) => {
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
export function useDeleteMediaFile(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
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
export function usePublishedPages(options) {
    return usePages({ status: PageStatus.PUBLISHED }, options);
}
export function useDraftPages(options) {
    return usePages({ status: PageStatus.DRAFT }, options);
}
export function useImageFiles(options) {
    return useMediaFiles({ mime_type_filter: 'image/' }, options);
}
// Additional utility hooks for better developer experience
export function useCurrentUser(options) {
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
export function useSubmitContactForm(options) {
    return useMutation({
        mutationFn: async (request) => {
            const service = getContactService();
            return service.submitContactForm(request);
        },
        ...options,
    });
}
export function useContactSubmissions(request = {}, options) {
    return useQuery({
        queryKey: queryKeys.contact.submissionsList(request),
        queryFn: async () => {
            const service = getContactService();
            return service.listContactSubmissions(request);
        },
        ...options,
    });
}
export function useContactSubmission(id, options) {
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
export function useMarkContactSubmissionAsRead(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
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
export function useDeleteContactSubmission(options) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
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
