import type { ApiClient } from './client';
import type { ApiResponse, MediaFile, UploadFileRequest, GetFileRequest, DeleteFileRequest, ListFilesRequest, ListFilesResponse, UpdateFileRequest } from './types';
export declare class MediaService {
    private client;
    constructor(client: ApiClient);
    uploadFile(request: UploadFileRequest): Promise<ApiResponse<MediaFile>>;
    uploadFile(file: File, altText?: string): Promise<ApiResponse<MediaFile>>;
    getFile(request: GetFileRequest): Promise<ApiResponse<MediaFile>>;
    deleteFile(request: DeleteFileRequest): Promise<ApiResponse<void>>;
    listFiles(request?: ListFilesRequest): Promise<ApiResponse<ListFilesResponse>>;
    updateFile(request: UpdateFileRequest): Promise<ApiResponse<MediaFile>>;
}
//# sourceMappingURL=media.d.ts.map