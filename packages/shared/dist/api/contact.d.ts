import type { ApiClient } from './client';
import type { ApiResponse, ContactSubmission, SubmitContactFormRequest, ListContactSubmissionsRequest, ListContactSubmissionsResponse, GetContactSubmissionRequest, MarkContactSubmissionAsReadRequest, DeleteContactSubmissionRequest } from './types';
export declare class ContactService {
    private client;
    constructor(client: ApiClient);
    submitContactForm(request: SubmitContactFormRequest): Promise<ApiResponse<ContactSubmission>>;
    listContactSubmissions(request?: ListContactSubmissionsRequest): Promise<ApiResponse<ListContactSubmissionsResponse>>;
    getContactSubmission(request: GetContactSubmissionRequest): Promise<ApiResponse<ContactSubmission>>;
    markContactSubmissionAsRead(request: MarkContactSubmissionAsReadRequest): Promise<ApiResponse<ContactSubmission>>;
    deleteContactSubmission(request: DeleteContactSubmissionRequest): Promise<ApiResponse<void>>;
}
//# sourceMappingURL=contact.d.ts.map