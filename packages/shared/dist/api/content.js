export class ContentService {
    client;
    constructor(client) {
        this.client = client;
    }
    async createPage(request) {
        return this.client.post('/api/v1/pages', request);
    }
    async getPage(request) {
        return this.client.get(`/api/v1/pages/${request.id}`);
    }
    async updatePage(request) {
        const { id, ...updateData } = request;
        return this.client.put(`/api/v1/pages/${id}`, updateData);
    }
    async deletePage(request) {
        return this.client.delete(`/api/v1/pages/${request.id}`);
    }
    async listPages(request = {}) {
        const params = {};
        if (request.page_size)
            params.page_size = request.page_size.toString();
        if (request.page_token)
            params.page_token = request.page_token;
        if (request.status)
            params.status = request.status;
        if (request.search)
            params.search = request.search;
        return this.client.get('/api/v1/pages', params);
    }
    // Blog post methods
    async createBlogPost(request) {
        return this.client.post('/api/v1/blog', request);
    }
    async getBlogPost(request) {
        return this.client.get(`/api/v1/blog/${request.id}`);
    }
    async updateBlogPost(request) {
        const { id, ...updateData } = request;
        return this.client.put(`/api/v1/blog/${id}`, updateData);
    }
    async deleteBlogPost(request) {
        return this.client.delete(`/api/v1/blog/${request.id}`);
    }
    async listBlogPosts(request = {}) {
        const params = {};
        if (request.page_size)
            params.page_size = request.page_size.toString();
        if (request.page_token)
            params.page_token = request.page_token;
        if (request.status)
            params.status = request.status;
        if (request.category)
            params.category = request.category;
        if (request.tag)
            params.tag = request.tag;
        if (request.author)
            params.author = request.author;
        return this.client.get('/api/v1/blog', params);
    }
    async searchBlogPosts(request) {
        const params = {
            query: request.query,
        };
        if (request.page_size)
            params.page_size = request.page_size.toString();
        if (request.page_token)
            params.page_token = request.page_token;
        if (request.category)
            params.category = request.category;
        if (request.tag)
            params.tag = request.tag;
        return this.client.get('/api/v1/blog/search', params);
    }
    async getBlogCategories(request = {}) {
        return this.client.get('/api/v1/blog/categories');
    }
    async getBlogTags(request = {}) {
        return this.client.get('/api/v1/blog/tags');
    }
    async getRSSFeed(request = {}) {
        return this.client.get('/api/v1/blog/rss');
    }
}
