/**
 * Environment Configuration for Integration Tests
 * Sets up environment variables for integration testing
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Service URLs (can be overridden by Docker Compose)
process.env.BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
process.env.WEBSITE_URL = process.env.WEBSITE_URL || 'http://localhost:3000';
process.env.CMS_URL = process.env.CMS_URL || 'http://localhost:3001';
process.env.COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';

// Database configuration
process.env.COUCHDB_USER = process.env.COUCHDB_USER || 'test_admin';
process.env.COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'test_password';

// Authentication configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-nextauth-secret';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// API configuration
process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Disable telemetry
process.env.NEXT_TELEMETRY_DISABLED = '1';

console.log('Integration test environment configured:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- BACKEND_URL:', process.env.BACKEND_URL);
console.log('- WEBSITE_URL:', process.env.WEBSITE_URL);
console.log('- CMS_URL:', process.env.CMS_URL);
console.log('- COUCHDB_URL:', process.env.COUCHDB_URL);