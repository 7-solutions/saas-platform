export class ContactService {
    client;
    constructor(client) {
        this.client = client;
    }
    async submitContactForm(request) {
        return this.client.post('/api/v1/contact', request);
    }
    async listContactSubmissions(request = {}) {
        const params = {};
        if (request.page_size)
            params.page_size = request.page_size.toString();
        if (request.page_token)
            params.page_token = request.page_token;
        if (request.status)
            params.status = request.status;
        if (request.search)
            params.search = request.search;
        return this.client.get('/api/v1/contact/submissions', params);
    }
    async getContactSubmission(request) {
        return this.client.get(`/api/v1/contact/submissions/${request.id}`);
    }
    async markContactSubmissionAsRead(request) {
        return this.client.put(`/api/v1/contact/submissions/${request.id}/read`, {});
    }
    async deleteContactSubmission(request) {
        return this.client.delete(`/api/v1/contact/submissions/${request.id}`);
    }
}
