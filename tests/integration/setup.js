/**
 * Integration Test Setup
 * Global setup for integration tests
 */

const axios = require('axios');

// Global test configuration
global.BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
global.WEBSITE_URL = process.env.WEBSITE_URL || 'http://localhost:3000';
global.CMS_URL = process.env.CMS_URL || 'http://localhost:3001';
global.COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
global.TIMEOUT = 30000;

// Global axios instance for tests
global.api = axios.create({
  timeout: global.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Global test utilities
global.waitForService = async (url, maxRetries = 30, retryDelay = 1000) => {
  let retries = maxRetries;
  while (retries > 0) {
    try {
      await axios.get(url, { timeout: 5000 });
      return true;
    } catch (error) {
      retries--;
      if (retries === 0) {
        throw new Error(`Service at ${url} failed to start within timeout period`);
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
};

// Global cleanup function
global.cleanup = async () => {
  // Add any global cleanup logic here
  console.log('Running global test cleanup...');
};

// Setup Jest hooks
beforeAll(async () => {
  console.log('Setting up integration tests...');
  console.log('Backend URL:', global.BACKEND_URL);
  console.log('Website URL:', global.WEBSITE_URL);
  console.log('CMS URL:', global.CMS_URL);
  console.log('CouchDB URL:', global.COUCHDB_URL);
}, 60000);

afterAll(async () => {
  await global.cleanup();
}, 30000);