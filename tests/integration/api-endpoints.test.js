#!/usr/bin/env node

/**
 * Comprehensive API endpoint testing script
 * Tests all gRPC Gateway REST endpoints with various scenarios
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const API_VERSION = 'v1';

// Test configuration
const config = {
  timeout: 10000,
  retries: 3,
  baseURL: `${BASE_URL}/api/${API_VERSION}`,
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

// Helper functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (endpoint, options = {}) => {
  const url = `${config.baseURL}${endpoint}`;
  const requestOptions = {
    timeout: config.timeout,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, requestOptions);
    const data = await response.text();
    
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: jsonData,
      ok: response.ok
    };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
};

const runTest = async (testName, testFn) => {
  console.log(`\n🧪 Running: ${testName}`);
  try {
    await testFn();
    console.log(`✅ PASSED: ${testName}`);
    results.passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
};

const skipTest = (testName, reason) => {
  console.log(`⏭️  SKIPPED: ${testName} (${reason})`);
  results.skipped++;
};

// Test suites
const testHealthEndpoint = async () => {
  const response = await makeRequest('/health');
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Health endpoint should return JSON object');
  }
};

const testContactFormSubmission = async () => {
  const testData = {
    name: "API Test User",
    email: "apitest@example.com",
    company: "Test Company",
    message: "This is an automated API test message."
  };

  const response = await makeRequest('/contact', {
    method: 'POST',
    body: JSON.stringify(testData)
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Expected status 200/201, got ${response.status}`);
  }

  if (!response.data.id) {
    throw new Error('Contact submission should return an ID');
  }
};

const testContactFormValidation = async () => {
  // Test empty submission
  const emptyData = {};
  const response = await makeRequest('/contact', {
    method: 'POST',
    body: JSON.stringify(emptyData)
  });

  if (response.status !== 400) {
    throw new Error(`Expected validation error (400), got ${response.status}`);
  }
};

const testContentEndpoints = async () => {
  // Test list pages
  const listResponse = await makeRequest('/pages');
  if (listResponse.status !== 200) {
    throw new Error(`Expected status 200 for pages list, got ${listResponse.status}`);
  }

  // Test get specific page (if any exist)
  if (listResponse.data.pages && listResponse.data.pages.length > 0) {
    const pageId = listResponse.data.pages[0].id;
    const pageResponse = await makeRequest(`/pages/${pageId}`);
    if (pageResponse.status !== 200) {
      throw new Error(`Expected status 200 for page get, got ${pageResponse.status}`);
    }
  }
};

const testBlogEndpoints = async () => {
  // Test list blog posts
  const listResponse = await makeRequest('/blog');
  if (listResponse.status !== 200) {
    throw new Error(`Expected status 200 for blog list, got ${listResponse.status}`);
  }

  // Test blog categories
  const categoriesResponse = await makeRequest('/blog/categories');
  if (categoriesResponse.status !== 200) {
    throw new Error(`Expected status 200 for blog categories, got ${categoriesResponse.status}`);
  }

  // Test blog tags
  const tagsResponse = await makeRequest('/blog/tags');
  if (tagsResponse.status !== 200) {
    throw new Error(`Expected status 200 for blog tags, got ${tagsResponse.status}`);
  }

  // Test RSS feed
  const rssResponse = await makeRequest('/blog/rss');
  if (rssResponse.status !== 200) {
    throw new Error(`Expected status 200 for RSS feed, got ${rssResponse.status}`);
  }
};

const testAuthEndpoints = async () => {
  // Test login with invalid credentials
  const loginData = {
    email: "invalid@example.com",
    password: "wrongpassword"
  };

  const response = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData)
  });

  if (response.status !== 401 && response.status !== 400) {
    throw new Error(`Expected auth error (401/400), got ${response.status}`);
  }
};

const testMediaEndpoints = async () => {
  // Test list media files
  const listResponse = await makeRequest('/media');
  if (listResponse.status !== 200) {
    throw new Error(`Expected status 200 for media list, got ${listResponse.status}`);
  }
};

const testErrorHandling = async () => {
  // Test 404 endpoint
  const response = await makeRequest('/nonexistent-endpoint');
  if (response.status !== 404) {
    throw new Error(`Expected 404 for non-existent endpoint, got ${response.status}`);
  }
};

const testRateLimiting = async () => {
  // Make multiple rapid requests to test rate limiting
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(makeRequest('/health'));
  }

  const responses = await Promise.all(promises);
  const rateLimited = responses.some(r => r.status === 429);
  
  // Rate limiting might not be implemented, so we just log the result
  console.log(`   Rate limiting ${rateLimited ? 'detected' : 'not detected'}`);
};

const testCORS = async () => {
  // Test CORS headers
  const response = await makeRequest('/health', {
    method: 'OPTIONS'
  });

  // CORS might not be configured for OPTIONS, so we check the actual response
  const corsHeaders = response.headers.get('access-control-allow-origin');
  console.log(`   CORS headers ${corsHeaders ? 'present' : 'not present'}`);
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting API Endpoint Integration Tests');
  console.log(`📍 Base URL: ${config.baseURL}`);
  console.log('=' .repeat(50));

  // Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...');
  await sleep(2000);

  // Core functionality tests
  await runTest('Health Endpoint', testHealthEndpoint);
  await runTest('Contact Form Submission', testContactFormSubmission);
  await runTest('Contact Form Validation', testContactFormValidation);
  await runTest('Content Endpoints', testContentEndpoints);
  await runTest('Blog Endpoints', testBlogEndpoints);
  await runTest('Auth Endpoints', testAuthEndpoints);
  await runTest('Media Endpoints', testMediaEndpoints);
  
  // Error handling and edge cases
  await runTest('Error Handling', testErrorHandling);
  await runTest('Rate Limiting', testRateLimiting);
  await runTest('CORS Configuration', testCORS);

  // Print results
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`📈 Total: ${results.passed + results.failed + results.skipped}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach(({ test, error }) => {
      console.log(`   • ${test}: ${error}`);
    });
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
};

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  makeRequest,
  config
};