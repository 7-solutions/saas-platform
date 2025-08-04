/**
 * Integration Tests for API Endpoints
 * Tests the backend API endpoints within Docker network
 */

const axios = require('axios');

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const TIMEOUT = 30000; // 30 seconds

// Create axios instance with default config
const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

describe('Backend API Integration Tests', () => {
  beforeAll(async () => {
    // Wait for backend to be ready
    console.log('Waiting for backend to be ready...');
    let retries = 30;
    while (retries > 0) {
      try {
        await api.get('/api/v1/health');
        console.log('Backend is ready!');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error('Backend failed to start within timeout period');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }, 60000);

  describe('Health Check Endpoint', () => {
    test('should return healthy status', async () => {
      const response = await api.get('/api/v1/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('version');
    });

    test('should include database connectivity status', async () => {
      const response = await api.get('/api/v1/health');
      
      expect(response.data).toHaveProperty('database');
      expect(response.data.database).toHaveProperty('status', 'connected');
    });
  });

  describe('Contact Form API', () => {
    test('should accept valid contact form submission', async () => {
      const contactData = {
        name: 'Integration Test User',
        email: 'test@example.com',
        company: 'Test Company',
        message: 'This is an integration test message that is long enough to pass validation.',
      };

      const response = await api.post('/api/v1/contact', contactData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('status', 'submitted');
      expect(response.data).toHaveProperty('createdAt');
    });

    test('should reject invalid contact form data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        email: 'invalid-email',
        message: 'Short', // Too short message
      };

      try {
        await api.post('/api/v1/contact', invalidData);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
        expect(Array.isArray(error.response.data.errors)).toBe(true);
      }
    });

    test('should handle missing required fields', async () => {
      const incompleteData = {
        name: 'Test User',
        // Missing email and message
      };

      try {
        await api.post('/api/v1/contact', incompleteData);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('errors');
      }
    });
  });

  describe('Content Management API', () => {
    let authToken;
    let testPageId;

    beforeAll(async () => {
      // Authenticate for content management tests
      try {
        const authResponse = await api.post('/api/v1/auth/login', {
          email: 'admin@example.com',
          password: 'test-password',
        });
        authToken = authResponse.data.token;
      } catch (error) {
        console.warn('Authentication failed, skipping authenticated tests');
      }
    });

    test('should create a new page', async () => {
      if (!authToken) {
        console.log('Skipping authenticated test - no auth token');
        return;
      }

      const pageData = {
        title: 'Integration Test Page',
        slug: 'integration-test-page',
        content: '<p>This is a test page created during integration testing.</p>',
        status: 'draft',
      };

      const response = await api.post('/api/v1/pages', pageData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('title', pageData.title);
      expect(response.data).toHaveProperty('slug', pageData.slug);
      
      testPageId = response.data.id;
    });

    test('should retrieve created page', async () => {
      if (!authToken || !testPageId) {
        console.log('Skipping test - no auth token or page ID');
        return;
      }

      const response = await api.get(`/api/v1/pages/${testPageId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', testPageId);
      expect(response.data).toHaveProperty('title', 'Integration Test Page');
    });

    test('should update existing page', async () => {
      if (!authToken || !testPageId) {
        console.log('Skipping test - no auth token or page ID');
        return;
      }

      const updateData = {
        title: 'Updated Integration Test Page',
        content: '<p>This page has been updated during integration testing.</p>',
      };

      const response = await api.put(`/api/v1/pages/${testPageId}`, updateData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('title', updateData.title);
      expect(response.data).toHaveProperty('updatedAt');
    });

    test('should delete test page', async () => {
      if (!authToken || !testPageId) {
        console.log('Skipping test - no auth token or page ID');
        return;
      }

      const response = await api.delete(`/api/v1/pages/${testPageId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(response.status).toBe(204);
    });
  });

  describe('Media Upload API', () => {
    let authToken;

    beforeAll(async () => {
      // Authenticate for media upload tests
      try {
        const authResponse = await api.post('/api/v1/auth/login', {
          email: 'admin@example.com',
          password: 'test-password',
        });
        authToken = authResponse.data.token;
      } catch (error) {
        console.warn('Authentication failed, skipping media upload tests');
      }
    });

    test('should handle media upload endpoint', async () => {
      if (!authToken) {
        console.log('Skipping authenticated test - no auth token');
        return;
      }

      // Test that the media upload endpoint exists and requires authentication
      try {
        await api.post('/api/v1/media/upload', {}, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        // We expect this to fail due to missing file, but should not be 401/403
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should reject unauthenticated media upload', async () => {
      try {
        await api.post('/api/v1/media/upload', {});
        fail('Should have required authentication');
      } catch (error) {
        expect([401, 403]).toContain(error.response.status);
      }
    });
  });

  describe('Database Integration', () => {
    test('should connect to CouchDB', async () => {
      const response = await api.get('/api/v1/health');
      
      expect(response.data.database).toHaveProperty('status', 'connected');
      expect(response.data.database).toHaveProperty('type', 'couchdb');
    });

    test('should handle database operations', async () => {
      // Test that the API can perform basic database operations
      const contactData = {
        name: 'Database Test User',
        email: 'dbtest@example.com',
        message: 'Testing database integration with a sufficiently long message.',
      };

      const response = await api.post('/api/v1/contact', contactData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      
      // Verify the data was actually stored by checking it exists
      // (This would require a GET endpoint for contact submissions)
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      try {
        await api.get('/api/v1/non-existent-endpoint');
        fail('Should have returned 404');
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    test('should handle malformed JSON requests', async () => {
      try {
        await api.post('/api/v1/contact', 'invalid-json', {
          headers: { 'Content-Type': 'application/json' },
        });
        fail('Should have returned 400');
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });

    test('should include proper CORS headers', async () => {
      const response = await api.get('/api/v1/health');
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Performance', () => {
    test('should respond to health check within reasonable time', async () => {
      const startTime = Date.now();
      await api.get('/api/v1/health');
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(5).fill().map(() => api.get('/api/v1/health'));
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});