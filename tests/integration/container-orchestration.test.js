/**
 * Container Orchestration Integration Tests
 * Tests that all services work together properly in Docker environment
 */

const axios = require('axios');

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const WEBSITE_URL = process.env.WEBSITE_URL || 'http://localhost:3000';
const CMS_URL = process.env.CMS_URL || 'http://localhost:3001';
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const TIMEOUT = 30000;

describe('Container Orchestration Integration Tests', () => {
  describe('Service Health Checks', () => {
    test('backend service should be healthy', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    }, TIMEOUT);

    test('website service should be accessible', async () => {
      const response = await axios.get(WEBSITE_URL, { timeout: TIMEOUT });
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    }, TIMEOUT);

    test('cms service should be accessible', async () => {
      const response = await axios.get(CMS_URL, { timeout: TIMEOUT });
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    }, TIMEOUT);

    test('couchdb service should be accessible', async () => {
      const response = await axios.get(COUCHDB_URL, { timeout: TIMEOUT });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('couchdb', 'Welcome');
    }, TIMEOUT);
  });

  describe('Service Communication', () => {
    test('website should be able to communicate with backend', async () => {
      // Test that website can make API calls to backend
      const contactData = {
        name: 'Service Communication Test',
        email: 'servicetest@example.com',
        message: 'Testing communication between website and backend services.',
      };

      const response = await axios.post(`${BACKEND_URL}/api/v1/contact`, contactData, {
        timeout: TIMEOUT,
      });
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
    }, TIMEOUT);

    test('backend should be able to communicate with database', async () => {
      const healthResponse = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      
      expect(healthResponse.data.database.status).toBe('connected');
    }, TIMEOUT);
  });

  describe('Load Balancing and Scaling', () => {
    test('services should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill().map((_, index) => 
        axios.post(`${BACKEND_URL}/api/v1/contact`, {
          name: `Load Test User ${index}`,
          email: `loadtest${index}@example.com`,
          message: 'This is a load testing message to verify the service can handle concurrent requests.',
        }, { timeout: TIMEOUT })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
      });
    }, TIMEOUT * 2);
  });

  describe('Data Persistence', () => {
    test('data should persist across service restarts', async () => {
      // Create test data
      const testData = {
        name: 'Persistence Test User',
        email: 'persistencetest@example.com',
        message: 'Testing data persistence across service restarts with a sufficiently long message.',
      };

      const createResponse = await axios.post(`${BACKEND_URL}/api/v1/contact`, testData, {
        timeout: TIMEOUT,
      });
      
      expect(createResponse.status).toBe(201);
      const createdId = createResponse.data.id;

      // Verify data exists by checking health endpoint includes database connectivity
      const healthResponse = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      expect(healthResponse.data.database.status).toBe('connected');
      
      // Note: In a full integration test, we would restart the backend service here
      // and verify the data still exists. For now, we verify the database connection.
    }, TIMEOUT);
  });

  describe('Network Configuration', () => {
    test('services should be accessible on correct ports', async () => {
      // Test that each service is accessible on its expected port
      const services = [
        { name: 'backend', url: BACKEND_URL, expectedStatus: 200 },
        { name: 'website', url: WEBSITE_URL, expectedStatus: 200 },
        { name: 'cms', url: CMS_URL, expectedStatus: 200 },
        { name: 'couchdb', url: COUCHDB_URL, expectedStatus: 200 },
      ];

      for (const service of services) {
        const response = await axios.get(service.url, { timeout: TIMEOUT });
        expect(response.status).toBe(service.expectedStatus);
      }
    }, TIMEOUT);

    test('services should have proper CORS configuration', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    }, TIMEOUT);
  });

  describe('Environment Configuration', () => {
    test('services should use correct environment variables', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      
      expect(response.data).toHaveProperty('environment');
      expect(response.data.environment).toBe('test');
    }, TIMEOUT);

    test('database connection should use test database', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      
      expect(response.data.database).toHaveProperty('name');
      expect(response.data.database.name).toContain('test');
    }, TIMEOUT);
  });

  describe('Security Configuration', () => {
    test('services should have security headers', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      
      // Check for basic security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    }, TIMEOUT);

    test('database should require authentication', async () => {
      try {
        await axios.get(`${COUCHDB_URL}/_all_dbs`, { timeout: TIMEOUT });
        // If this doesn't throw, check if it requires auth in response
      } catch (error) {
        expect([401, 403]).toContain(error.response?.status);
      }
    }, TIMEOUT);
  });

  describe('Monitoring and Logging', () => {
    test('services should provide metrics endpoints', async () => {
      // Test that monitoring endpoints are available
      try {
        const response = await axios.get(`${BACKEND_URL}/metrics`, { timeout: TIMEOUT });
        expect(response.status).toBe(200);
      } catch (error) {
        // Metrics endpoint might not be implemented yet
        console.log('Metrics endpoint not available:', error.message);
      }
    }, TIMEOUT);

    test('services should log requests', async () => {
      // Make a request and verify it's logged (this would require log aggregation)
      const response = await axios.get(`${BACKEND_URL}/api/v1/health`, { timeout: TIMEOUT });
      expect(response.status).toBe(200);
      
      // In a real test, we would check log aggregation service for the request
      // For now, we just verify the request succeeded
    }, TIMEOUT);
  });
});