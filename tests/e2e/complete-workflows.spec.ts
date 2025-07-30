import { test, expect, Page } from '@playwright/test';

/**
 * Complete user workflow end-to-end tests
 * Tests entire user journeys from start to finish
 */

test.describe('Complete User Workflows', () => {
  
  test.describe('Public Website User Journey', () => {
    test('should complete full visitor journey', async ({ page }) => {
      // 1. Visit homepage
      await page.goto('/');
      await expect(page).toHaveTitle(/SaaS Platform/);
      
      // 2. Navigate through main sections
      await page.locator('a[href="/about"]').first().click();
      await expect(page).toHaveURL('/about');
      await expect(page.locator('h1')).toBeVisible();
      
      // 3. Check services page
      await page.locator('a[href="/services"]').first().click();
      await expect(page).toHaveURL('/services');
      await expect(page.locator('h1')).toBeVisible();
      
      // 4. Visit blog
      const blogLink = page.locator('a[href="/blog"]').first();
      if (await blogLink.isVisible()) {
        await blogLink.click();
        await expect(page).toHaveURL('/blog');
        
        // Check if blog posts exist and click on one
        const firstPost = page.locator('article a').first();
        if (await firstPost.isVisible()) {
          await firstPost.click();
          await expect(page.locator('article')).toBeVisible();
        }
      }
      
      // 5. Complete contact form submission
      await page.goto('/contact');
      await page.locator('input[name="name"]').fill('E2E Test User');
      await page.locator('input[name="email"]').fill('e2e@example.com');
      await page.locator('input[name="company"]').fill('Test Company');
      await page.locator('textarea[name="message"]').fill('This is an end-to-end test message.');
      
      await page.locator('button[type="submit"]').click();
      
      // Wait for success message or redirect
      await expect(page.locator('text=Thank you')).toBeVisible({ timeout: 10000 });
    });

    test('should handle responsive navigation', async ({ page }) => {
      // Test desktop navigation
      await page.goto('/');
      await expect(page.locator('nav')).toBeVisible();
      
      // Test mobile navigation
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // Check if mobile menu exists
      const mobileMenuButton = page.locator('button[aria-label*="menu"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        await expect(page.locator('nav')).toBeVisible();
      }
      
      // Test navigation on mobile
      const aboutLink = page.locator('a[href="/about"]').first();
      if (await aboutLink.isVisible()) {
        await aboutLink.click();
        await expect(page).toHaveURL('/about');
      }
    });

    test('should handle search functionality', async ({ page }) => {
      await page.goto('/blog');
      
      // Look for search functionality
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.keyboard.press('Enter');
        
        // Wait for search results
        await page.waitForTimeout(2000);
        await expect(page.locator('article, .search-result')).toBeVisible();
      }
    });
  });

  test.describe('CMS Admin Workflow', () => {
    // Helper function for login
    async function loginToCMS(page: Page) {
      await page.goto('http://localhost:3001/login');
      
      // Fill login form (using test credentials)
      await page.locator('input[name="email"]').fill('admin@example.com');
      await page.locator('input[name="password"]').fill('password');
      await page.locator('button[type="submit"]').click();
      
      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }

    test('should complete content creation workflow', async ({ page }) => {
      test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
      
      // 1. Login to CMS
      await loginToCMS(page);
      
      // 2. Navigate to pages
      await page.locator('a[href*="pages"]').click();
      await expect(page).toHaveURL(/pages/);
      
      // 3. Create new page
      const createButton = page.locator('button:has-text("Create"), a:has-text("New Page")');
      if (await createButton.isVisible()) {
        await createButton.click();
        
        // Fill page form
        await page.locator('input[name="title"]').fill('E2E Test Page');
        await page.locator('input[name="slug"]').fill('e2e-test-page');
        
        // Fill content editor
        const contentEditor = page.locator('[contenteditable="true"], textarea[name="content"]');
        if (await contentEditor.isVisible()) {
          await contentEditor.fill('This is test content created by E2E tests.');
        }
        
        // Save page
        await page.locator('button:has-text("Save"), button:has-text("Publish")').click();
        
        // Verify page was created
        await expect(page.locator('text=E2E Test Page')).toBeVisible({ timeout: 10000 });
      }
    });

    test('should complete media upload workflow', async ({ page }) => {
      test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
      
      // 1. Login to CMS
      await loginToCMS(page);
      
      // 2. Navigate to media library
      await page.locator('a[href*="media"]').click();
      await expect(page).toHaveURL(/media/);
      
      // 3. Upload media file
      const uploadButton = page.locator('input[type="file"], button:has-text("Upload")');
      if (await uploadButton.isVisible()) {
        // Create a test file
        const testImagePath = 'tests/fixtures/test-image.png';
        
        // If file input exists, upload file
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible()) {
          await fileInput.setInputFiles(testImagePath);
          
          // Wait for upload to complete
          await expect(page.locator('img, .media-item')).toBeVisible({ timeout: 15000 });
        }
      }
    });

    test('should complete user management workflow', async ({ page }) => {
      test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
      
      // 1. Login to CMS
      await loginToCMS(page);
      
      // 2. Navigate to user management (if exists)
      const usersLink = page.locator('a[href*="users"], a:has-text("Users")');
      if (await usersLink.isVisible()) {
        await usersLink.click();
        
        // 3. View user list
        await expect(page.locator('table, .user-list')).toBeVisible();
        
        // 4. Test user profile update
        const profileLink = page.locator('a[href*="profile"], button:has-text("Profile")');
        if (await profileLink.isVisible()) {
          await profileLink.click();
          
          // Update profile information
          const nameInput = page.locator('input[name="name"]');
          if (await nameInput.isVisible()) {
            await nameInput.fill('Updated Admin Name');
            await page.locator('button:has-text("Save")').click();
            
            // Verify update
            await expect(page.locator('text=Updated Admin Name')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Cross-Application Integration', () => {
    test('should sync content between CMS and public website', async ({ page, context }) => {
      test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
      
      // 1. Create content in CMS
      const cmsPage = await context.newPage();
      await cmsPage.goto('http://localhost:3001/login');
      
      // Login and create content
      await cmsPage.locator('input[name="email"]').fill('admin@example.com');
      await cmsPage.locator('input[name="password"]').fill('password');
      await cmsPage.locator('button[type="submit"]').click();
      await cmsPage.waitForURL('**/dashboard');
      
      // Create a new page
      await cmsPage.locator('a[href*="pages"]').click();
      const createButton = cmsPage.locator('button:has-text("Create"), a:has-text("New Page")');
      if (await createButton.isVisible()) {
        await createButton.click();
        
        await cmsPage.locator('input[name="title"]').fill('Integration Test Page');
        await cmsPage.locator('input[name="slug"]').fill('integration-test');
        
        const contentEditor = cmsPage.locator('[contenteditable="true"], textarea[name="content"]');
        if (await contentEditor.isVisible()) {
          await contentEditor.fill('This page tests CMS to website integration.');
        }
        
        // Publish the page
        await cmsPage.locator('button:has-text("Publish")').click();
        await cmsPage.waitForTimeout(2000);
      }
      
      // 2. Verify content appears on public website
      await page.goto('/integration-test');
      await expect(page.locator('h1:has-text("Integration Test Page")')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=This page tests CMS to website integration')).toBeVisible();
      
      await cmsPage.close();
    });

    test('should handle API communication between frontend and backend', async ({ page }) => {
      // Test API communication by monitoring network requests
      const apiRequests: string[] = [];
      
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiRequests.push(request.url());
        }
      });
      
      // Navigate through the site to trigger API calls
      await page.goto('/');
      await page.goto('/blog');
      await page.goto('/contact');
      
      // Fill and submit contact form to trigger API call
      await page.locator('input[name="name"]').fill('API Test User');
      await page.locator('input[name="email"]').fill('apitest@example.com');
      await page.locator('textarea[name="message"]').fill('Testing API communication');
      await page.locator('button[type="submit"]').click();
      
      // Wait for API call to complete
      await page.waitForTimeout(3000);
      
      // Verify API calls were made
      expect(apiRequests.length).toBeGreaterThan(0);
      expect(apiRequests.some(url => url.includes('/contact'))).toBeTruthy();
    });
  });

  test.describe('Error Handling Workflows', () => {
    test('should handle 404 pages gracefully', async ({ page }) => {
      await page.goto('/non-existent-page');
      
      // Should show 404 page
      await expect(page.locator('h1:has-text("404"), h1:has-text("Not Found")')).toBeVisible();
      
      // Should have navigation back to home
      const homeLink = page.locator('a[href="/"]');
      await expect(homeLink).toBeVisible();
      
      await homeLink.click();
      await expect(page).toHaveURL('/');
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure by blocking API requests
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('/contact');
      
      // Try to submit form
      await page.locator('input[name="name"]').fill('Network Test');
      await page.locator('input[name="email"]').fill('network@example.com');
      await page.locator('textarea[name="message"]').fill('Testing network error handling');
      await page.locator('button[type="submit"]').click();
      
      // Should show error message
      await expect(page.locator('text=error, text=failed')).toBeVisible({ timeout: 10000 });
    });

    test('should handle form validation errors', async ({ page }) => {
      await page.goto('/contact');
      
      // Submit empty form
      await page.locator('button[type="submit"]').click();
      
      // Should show validation errors
      await expect(page.locator('text=required')).toBeVisible();
      
      // Fill invalid email
      await page.locator('input[name="name"]').fill('Test User');
      await page.locator('input[name="email"]').fill('invalid-email');
      await page.locator('button[type="submit"]').click();
      
      // Should show email validation error
      await expect(page.locator('text=valid email')).toBeVisible();
    });
  });
});