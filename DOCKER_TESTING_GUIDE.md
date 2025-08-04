# Docker Testing Guide

## Overview

This guide covers comprehensive testing strategies for the SaaS Startup Platform within Docker containers. All testing operations are performed in containerized environments to ensure consistency and reliability.

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                         │
├─────────────────────────────────────────────────────────────┤
│  E2E Tests (Playwright)     │  Cross-browser, User journeys │
├─────────────────────────────────────────────────────────────┤
│  Integration Tests          │  API, Database, Services      │
├─────────────────────────────────────────────────────────────┤
│  Unit Tests (Jest/Vitest)   │  Components, Functions        │
└─────────────────────────────────────────────────────────────┘
```

## Test Environment Setup

### Docker Test Configuration

The platform uses `docker-compose.test.yml` for isolated testing:

```yaml
# docker-compose.test.yml
version: "3.9"
services:
  test-db:
    image: postgres:17.5
    environment:
      POSTGRES_DB: test_app
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_pass
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for speed
      
  website-test:
    build:
      context: .
      dockerfile: apps/website/Dockerfile.test
    depends_on:
      - test-db
    environment:
      NODE_ENV: test
      DATABASE_URL: postgres://test_user:test_pass@test-db:5432/test_app
```

### Test Database Setup

```bash
# Initialize test database
pnpm db:test:init

# Clean test database
pnpm db:test:clean

# Run database tests
pnpm db:test
```

## Unit Testing

### Running Unit Tests

```bash
# Run all unit tests in containers
pnpm test:docker:unit

# Run tests for specific app
docker compose -f docker-compose.test.yml run --rm website-test pnpm test

# Run tests with coverage
docker compose -f docker-compose.test.yml run --rm website-test pnpm test:coverage

# Watch mode for development
docker compose -f docker-compose.test.yml run --rm website-test pnpm test:watch
```

### Jest Configuration

```javascript
// jest.config.js - Optimized for Docker
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  collectCoverageFrom: [
    'app/**/*.{js,ts,jsx,tsx}',
    'components/**/*.{js,ts,jsx,tsx}',
    'lib/**/*.{js,ts,jsx,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // Docker-specific optimizations
  maxWorkers: '50%',
  cache: false,  // Avoid cache issues in containers
  forceExit: true
};
```

### Component Testing

```typescript
// Example component test
import { render, screen } from '@testing-library/react';
import { HomePage } from '../app/page';

describe('HomePage', () => {
  it('renders welcome message', () => {
    render(<HomePage />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('handles user interactions', async () => {
    render(<HomePage />);
    const button = screen.getByRole('button', { name: 'Get Started' });
    await user.click(button);
    expect(screen.getByText('Getting started...')).toBeInTheDocument();
  });
});
```

### Testing Utilities

```typescript
// test-utils.tsx - Custom render with providers
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { Providers } from '../components/providers';

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: Providers, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

## Integration Testing

### API Integration Tests

```bash
# Run API integration tests
pnpm test:integration:api

# Run specific API test suite
docker compose -f docker-compose.test.yml run --rm integration-test npm test -- --grep "Auth API"
```

### Database Integration Tests

```javascript
// Example database integration test
describe('User Repository', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('creates user successfully', async () => {
    const userData = { email: 'test@example.com', name: 'Test User' };
    const user = await userRepository.create(userData);
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
    
    // Verify in database
    const dbUser = await userRepository.findById(user.id);
    expect(dbUser).toMatchObject(userData);
  });
});
```

### Service Integration Tests

```bash
# Test service communication
pnpm test:integration:container

# Test authentication flow
docker compose -f docker-compose.test.yml run --rm integration-test npm test -- auth-flow.test.js

# Test file upload
docker compose -f docker-compose.test.yml run --rm integration-test npm test -- file-upload.test.js
```

## End-to-End Testing

### Playwright Configuration

```typescript
// playwright.config.ts - Docker-optimized
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'docker compose up --build',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run E2E tests in Docker
pnpm test:docker:e2e

# Run with UI mode
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e tests/e2e/auth.spec.ts

# Run tests in headed mode
pnpm test:e2e:headed
```

### E2E Test Examples

```typescript
// tests/e2e/user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Journey', () => {
  test('complete signup and login flow', async ({ page }) => {
    // Navigate to signup
    await page.goto('/signup');
    
    // Fill signup form
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password"]', 'SecurePass123!');
    
    // Submit form
    await page.click('[data-testid="signup-button"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('responsive design works correctly', async ({ page }) => {
    await page.goto('/');
    
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });
});
```

## Performance Testing

### Load Testing

```bash
# Run load tests
pnpm test:load

# Run backend load test
node tests/load/backend-load-test.js

# Monitor performance during tests
pnpm perf:runtime
```

### Performance Test Configuration

```javascript
// tests/load/backend-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 20 },   // Stay at 20 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
  },
};

export default function () {
  let response = http.get('http://localhost:8080/api/health');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

### Runtime Performance Monitoring

```bash
# Monitor page load performance
pnpm perf:runtime:pageload

# Monitor resource usage
pnpm perf:runtime:resources

# Run performance regression tests
pnpm perf:regression
```

## Security Testing

### Vulnerability Scanning

```bash
# Run security tests
pnpm test:security

# Scan dependencies for vulnerabilities
docker compose exec website pnpm audit

# Run security validation tests
node tests/integration/security-validation.test.js
```

### Security Test Examples

```javascript
// tests/integration/security-validation.test.js
describe('Security Validation', () => {
  it('prevents SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const response = await request(app)
      .post('/api/users/search')
      .send({ query: maliciousInput });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid input');
  });

  it('enforces authentication', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .expect(401);
    
    expect(response.body.error).toBe('Unauthorized');
  });

  it('validates CORS headers', async () => {
    const response = await request(app)
      .options('/api/health')
      .set('Origin', 'https://malicious-site.com');
    
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });
});
```

## Container Testing

### Container Health Tests

```bash
# Test container orchestration
pnpm test:containers

# Test container startup times
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### Docker Build Testing

```javascript
// tests/integration/container-orchestration.test.js
describe('Container Orchestration', () => {
  it('all services start successfully', async () => {
    const services = ['website', 'cms', 'postgres', 'api-gateway'];
    
    for (const service of services) {
      const health = await checkServiceHealth(service);
      expect(health.status).toBe('healthy');
      expect(health.startupTime).toBeLessThan(30000); // 30 seconds
    }
  });

  it('services communicate correctly', async () => {
    const response = await fetch('http://localhost:3000/api/health');
    expect(response.status).toBe(200);
    
    const apiResponse = await fetch('http://localhost:8080/health');
    expect(apiResponse.status).toBe(200);
  });
});
```

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    email: 'admin@example.com',
    password: 'AdminPass123!',
    role: 'admin'
  },
  user: {
    email: 'user@example.com',
    password: 'UserPass123!',
    role: 'user'
  }
};

// tests/fixtures/content.ts
export const testContent = {
  blogPost: {
    title: 'Test Blog Post',
    content: 'This is test content',
    status: 'published'
  }
};
```

### Database Seeding

```bash
# Seed test database
pnpm db:test:seed

# Clean test data
pnpm db:test:clean
```

```javascript
// scripts/seed-test-db.js
const seedTestData = async () => {
  // Create test users
  await createTestUsers();
  
  // Create test content
  await createTestContent();
  
  // Create test media
  await createTestMedia();
};
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Build test containers
        run: docker compose -f docker-compose.test.yml build
        
      - name: Run unit tests
        run: docker compose -f docker-compose.test.yml run --rm website-test pnpm test
        
      - name: Run integration tests
        run: docker compose -f docker-compose.test.yml run --rm integration-test
        
      - name: Run E2E tests
        run: docker compose -f docker-compose.test.yml run --rm e2e-test
        
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: |
            test-results/
            coverage/
            playwright-report/
```

### Test Reporting

```bash
# Generate test reports
pnpm test:coverage

# View coverage report
open coverage/lcov-report/index.html

# Generate E2E test report
pnpm test:e2e
open playwright-report/index.html
```

## Test Optimization

### Parallel Test Execution

```bash
# Run tests in parallel
docker compose -f docker-compose.test.yml up --scale website-test=3

# Use Jest parallel execution
docker compose -f docker-compose.test.yml run --rm website-test pnpm test --maxWorkers=4
```

### Test Caching

```dockerfile
# Dockerfile.test - Optimized for testing
FROM node:22-alpine AS test

# Cache test dependencies separately
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-test,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source and run tests
COPY . .
CMD ["pnpm", "test"]
```

### Resource Optimization

```yaml
# docker-compose.test.yml - Resource limits
services:
  website-test:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
```

## Debugging Tests

### Test Debugging

```bash
# Run tests with debug output
docker compose -f docker-compose.test.yml run --rm website-test pnpm test --verbose

# Debug specific test
docker compose -f docker-compose.test.yml run --rm website-test pnpm test --testNamePattern="User login"

# Run tests with Node.js debugger
docker compose -f docker-compose.test.yml run --rm -p 9229:9229 website-test node --inspect-brk=0.0.0.0:9229 node_modules/.bin/jest
```

### E2E Test Debugging

```bash
# Run E2E tests in headed mode
pnpm test:e2e:headed

# Debug with Playwright inspector
pnpm test:e2e --debug

# Record test execution
pnpm test:e2e --trace=on
```

## Best Practices

### Test Organization

```
tests/
├── unit/                 # Unit tests
│   ├── components/
│   ├── lib/
│   └── utils/
├── integration/          # Integration tests
│   ├── api/
│   ├── database/
│   └── services/
├── e2e/                  # End-to-end tests
│   ├── user-journeys/
│   ├── admin/
│   └── responsive/
├── load/                 # Performance tests
├── fixtures/             # Test data
└── helpers/              # Test utilities
```

### Test Naming Conventions

```typescript
// Good test naming
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', () => {});
    it('should throw error with invalid email', () => {});
    it('should hash password before saving', () => {});
  });
});
```

### Test Data Isolation

```typescript
// Ensure test isolation
beforeEach(async () => {
  await cleanDatabase();
  await seedTestData();
});

afterEach(async () => {
  await cleanDatabase();
});
```

For more information, see:
- [Docker Development Guide](./DOCKER_DEVELOPMENT_GUIDE.md)
- [Docker Troubleshooting Guide](./DOCKER_TROUBLESHOOTING_GUIDE.md)
- [Rollback Procedures](./DOCKER_ROLLBACK_PROCEDURES.md)