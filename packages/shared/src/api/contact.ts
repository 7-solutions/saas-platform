import type { ApiClient } from './client';
import type {
  ApiResponse,
  ContactSubmission,
  SubmitContactFormRequest,
  ListContactSubmissionsRequest,
  ListContactSubmissionsResponse,
  GetContactSubmissionRequest,
  MarkContactSubmissionAsReadRequest,
  DeleteContactSubmissionRequest,
} from './types';

export class ContactService {
  constructor(private client: ApiClient) {}

  async submitContactForm(request: SubmitContactFormRequest): Promise<ApiResponse<ContactSubmission>> {
    return this.client.post<ContactSubmission>('/api/v1/contact', request);
  }

  async listContactSubmissions(request: ListContactSubmissionsRequest = {}): Promise<ApiResponse<ListContactSubmissionsResponse>> {
    const params: Record<string, string> = {};
    
    if (request.page_size) params.page_size = request.page_size.toString();
    if (request.page_token) params.page_token = request.page_token;
    if (request.status) params.status = request.status;
    if (request.search) params.search = request.search;

    return this.client.get<ListContactSubmissionsResponse>('/api/v1/contact/submissions', params);
  }

  async getContactSubmission(request: GetContactSubmissionRequest): Promise<ApiResponse<ContactSubmission>> {
    return this.client.get<ContactSubmission>(`/api/v1/contact/submissions/${request.id}`);
  }

  async markContactSubmissionAsRead(request: MarkContactSubmissionAsReadRequest): Promise<ApiResponse<ContactSubmission>> {
    return this.client.put<ContactSubmission>(`/api/v1/contact/submissions/${request.id}/read`, {});
  }

  async deleteContactSubmission(request: DeleteContactSubmissionRequest): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/api/v1/contact/submissions/${request.id}`);
  }
}