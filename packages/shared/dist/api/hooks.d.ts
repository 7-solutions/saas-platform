import { type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import type { ApiClient } from './client';
import { ContentService } from './content';
import { ContactService } from './contact';
import { MediaService } from './media';
import type { ApiResponse, LoginRequest, LoginResponse, User, Page, CreatePageRequest, UpdatePageRequest, ListPagesRequest, ListPagesResponse, MediaFile, ListFilesRequest, ListFilesResponse, UpdateFileRequest, ContactSubmission, SubmitContactFormRequest, ListContactSubmissionsRequest, ListContactSubmissionsResponse } from './types';
export declare const queryKeys: {
    readonly auth: {
        readonly user: readonly ["auth", "user"];
    };
    readonly pages: {
        readonly all: readonly ["pages"];
        readonly lists: () => readonly ["pages", "list"];
        readonly list: (filters: ListPagesRequest) => readonly ["pages", "list", ListPagesRequest];
        readonly details: () => readonly ["pages", "detail"];
        readonly detail: (id: string) => readonly ["pages", "detail", string];
    };
    readonly media: {
        readonly all: readonly ["media"];
        readonly lists: () => readonly ["media", "list"];
        readonly list: (filters: ListFilesRequest) => readonly ["media", "list", ListFilesRequest];
        readonly details: () => readonly ["media", "detail"];
        readonly detail: (id: string) => readonly ["media", "detail", string];
    };
    readonly contact: {
        readonly all: readonly ["contact"];
        readonly submissions: () => readonly ["contact", "submissions"];
        readonly submissionsList: (filters: ListContactSubmissionsRequest) => readonly ["contact", "submissions", ListContactSubmissionsRequest];
        readonly submissionDetails: () => readonly ["contact", "submission"];
        readonly submissionDetail: (id: string) => readonly ["contact", "submission", string];
    };
};
export declare function setApiClient(client: ApiClient): void;
export declare function useLogin(options?: UseMutationOptions<ApiResponse<LoginResponse>, Error, LoginRequest>): import("@tanstack/react-query").UseMutationResult<ApiResponse<LoginResponse>, Error, LoginRequest, unknown>;
export declare function useLogout(options?: UseMutationOptions<ApiResponse<{
    success: boolean;
}>, Error, void>): import("@tanstack/react-query").UseMutationResult<ApiResponse<{
    success: boolean;
}>, Error, void, unknown>;
export declare function usePages(request?: ListPagesRequest, options?: UseQueryOptions<ApiResponse<ListPagesResponse>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<ListPagesResponse>, Error>;
export declare function usePage(id: string, options?: UseQueryOptions<ApiResponse<Page>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<Page>, Error>;
export declare function useCreatePage(options?: UseMutationOptions<ApiResponse<Page>, Error, CreatePageRequest>): import("@tanstack/react-query").UseMutationResult<ApiResponse<Page>, Error, CreatePageRequest, unknown>;
export declare function useUpdatePage(options?: UseMutationOptions<ApiResponse<Page>, Error, UpdatePageRequest>): import("@tanstack/react-query").UseMutationResult<ApiResponse<Page>, Error, UpdatePageRequest, unknown>;
export declare function useDeletePage(options?: UseMutationOptions<ApiResponse<void>, Error, string>): import("@tanstack/react-query").UseMutationResult<ApiResponse<void>, Error, string, unknown>;
export declare function useMediaFiles(request?: ListFilesRequest, options?: UseQueryOptions<ApiResponse<ListFilesResponse>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<ListFilesResponse>, Error>;
export declare function useMediaFile(id: string, options?: UseQueryOptions<ApiResponse<MediaFile>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<MediaFile>, Error>;
export declare function useUploadFile(options?: UseMutationOptions<ApiResponse<MediaFile>, Error, {
    file: File;
    altText?: string;
}>): import("@tanstack/react-query").UseMutationResult<ApiResponse<MediaFile>, Error, {
    file: File;
    altText?: string;
}, unknown>;
export declare function useUpdateMediaFile(options?: UseMutationOptions<ApiResponse<MediaFile>, Error, UpdateFileRequest>): import("@tanstack/react-query").UseMutationResult<ApiResponse<MediaFile>, Error, UpdateFileRequest, unknown>;
export declare function useDeleteMediaFile(options?: UseMutationOptions<ApiResponse<void>, Error, string>): import("@tanstack/react-query").UseMutationResult<ApiResponse<void>, Error, string, unknown>;
export declare function usePublishedPages(options?: UseQueryOptions<ApiResponse<ListPagesResponse>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<ListPagesResponse>, Error>;
export declare function useDraftPages(options?: UseQueryOptions<ApiResponse<ListPagesResponse>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<ListPagesResponse>, Error>;
export declare function useImageFiles(options?: UseQueryOptions<ApiResponse<ListFilesResponse>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<ListFilesResponse>, Error>;
export declare function useCurrentUser(options?: UseQueryOptions<ApiResponse<User>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<User>, Error>;
export declare function useInvalidateAllQueries(): () => void;
export declare function useContentApi(): ContentService;
export declare function useMediaApi(): MediaService;
export declare function useSubmitContactForm(options?: UseMutationOptions<ApiResponse<ContactSubmission>, Error, SubmitContactFormRequest>): import("@tanstack/react-query").UseMutationResult<ApiResponse<ContactSubmission>, Error, SubmitContactFormRequest, unknown>;
export declare function useContactSubmissions(request?: ListContactSubmissionsRequest, options?: UseQueryOptions<ApiResponse<ListContactSubmissionsResponse>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<ListContactSubmissionsResponse>, Error>;
export declare function useContactSubmission(id: string, options?: UseQueryOptions<ApiResponse<ContactSubmission>, Error>): import("@tanstack/react-query").UseQueryResult<ApiResponse<ContactSubmission>, Error>;
export declare function useMarkContactSubmissionAsRead(options?: UseMutationOptions<ApiResponse<ContactSubmission>, Error, string>): import("@tanstack/react-query").UseMutationResult<ApiResponse<ContactSubmission>, Error, string, unknown>;
export declare function useDeleteContactSubmission(options?: UseMutationOptions<ApiResponse<void>, Error, string>): import("@tanstack/react-query").UseMutationResult<ApiResponse<void>, Error, string, unknown>;
export declare function useContactApi(): ContactService;
//# sourceMappingURL=hooks.d.ts.map