import type { ApiClient } from './client';
import type {
  ApiResponse,
  MediaFile,
  UploadFileRequest,
  GetFileRequest,
  DeleteFileRequest,
  ListFilesRequest,
  ListFilesResponse,
  UpdateFileRequest,
} from './types';

export class MediaService {
  constructor(private client: ApiClient) {}

  async uploadFile(request: UploadFileRequest): Promise<ApiResponse<MediaFile>>;
  async uploadFile(file: File, altText?: string): Promise<ApiResponse<MediaFile>>;
  async uploadFile(requestOrFile: UploadFileRequest | File, altText?: string): Promise<ApiResponse<MediaFile>> {
    if (requestOrFile instanceof File) {
      // Handle File upload
      const additionalData: Record<string, string> = {};
      if (altText) {
        additionalData.alt_text = altText;
      }
      
      return this.client.uploadFile('/api/v1/media/upload', requestOrFile, additionalData);
    } else {
      // Handle UploadFileRequest
      const request = requestOrFile;
      const file = new File([request.content], request.filename, { type: request.mime_type });
      const additionalData: Record<string, string> = {};
      if (request.alt_text) {
        additionalData.alt_text = request.alt_text;
      }
      
      return this.client.uploadFile('/api/v1/media/upload', file, additionalData);
    }
  }

  async getFile(request: GetFileRequest): Promise<ApiResponse<MediaFile>> {
    return this.client.get<MediaFile>(`/api/v1/media/${request.id}`);
  }

  async deleteFile(request: DeleteFileRequest): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/api/v1/media/${request.id}`);
  }

  async listFiles(request: ListFilesRequest = {}): Promise<ApiResponse<ListFilesResponse>> {
    const params: Record<string, string> = {};
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.mime_type_filter) params.mime_type_filter = request.mime_type_filter;
    if (request.search) params.search = request.search;

    return this.client.get<ListFilesResponse>('/api/v1/media', params);
  }

  async updateFile(request: UpdateFileRequest): Promise<ApiResponse<MediaFile>> {
    const { id, ...updateData } = request;
    return this.client.put<MediaFile>(`/api/v1/media/${id}`, updateData);
  }
}