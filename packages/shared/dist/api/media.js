export class MediaService {
    client;
    constructor(client) {
        this.client = client;
    }
    async uploadFile(requestOrFile, altText) {
        if (requestOrFile instanceof File) {
            // Handle File upload
            const additionalData = {};
            if (altText) {
                additionalData.alt_text = altText;
            }
            return this.client.uploadFile('/api/v1/media/upload', requestOrFile, additionalData);
        }
        else {
            // Handle UploadFileRequest
            const request = requestOrFile;
            const file = new File([request.content], request.filename, { type: request.mime_type });
            const additionalData = {};
            if (request.alt_text) {
                additionalData.alt_text = request.alt_text;
            }
            return this.client.uploadFile('/api/v1/media/upload', file, additionalData);
        }
    }
    async getFile(request) {
        return this.client.get(`/api/v1/media/${request.id}`);
    }
    async deleteFile(request) {
        return this.client.delete(`/api/v1/media/${request.id}`);
    }
    async listFiles(request = {}) {
        const params = {};
        if (request.page_size)
            params.page_size = request.page_size.toString();
        if (request.page_token)
            params.page_token = request.page_token;
        if (request.mime_type_filter)
            params.mime_type_filter = request.mime_type_filter;
        if (request.search)
            params.search = request.search;
        return this.client.get('/api/v1/media', params);
    }
    async updateFile(request) {
        const { id, ...updateData } = request;
        return this.client.put(`/api/v1/media/${id}`, updateData);
    }
}
