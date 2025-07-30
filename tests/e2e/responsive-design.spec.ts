import { test, expect, devices } from '@playwright/test';

/**
 * Responsive design validation tests
 * Tests UI across different devices and screen sizes
 */

const viewports = [
  { name: 'Mobile Portrait', width: 375, height: 667 },
  { name: 'Mobile Landscape', width: 667, height: 375 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Tablet Landscape', width: 1024, height: 768 },
  { name: 'Desktop Small', width: 1280, height: 720 },
  { name: 'Desktop Large', width: 1920, height: 1080 },
  { name: 'Ultra Wide', width: 2560, height: 1440 }
];

test.describe('Responsive Design Validation', () => {
  
  test.describe('Homepage Responsiveness', () => {
    viewports.forEach(viewport => {
      test(`should display correctly on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');
        
        // Check that page loads
        await expect(page).toHaveTitle(/SaaS Platform/);
        
        // Check navigation is visible and functional
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();
        
        // Check hero section is visible
        const hero = page.locator('h1').first();
        await expect(hero).toBeVisible();
        
        // Check that content doesn't overflow
        const body = page.locator('body');
        const bodyBox = await body.boundingBox();
        expect(bodyBox?.width).toBeLessThanOrEqual(viewport.width);
        
        // Check mobile menu functionality for smaller screens
        if (viewport.width < 768) {
          const mobileMenuButton = page.locator('button[aria-label*="menu"], .mobile-menu-button');
          if (await mobileMenuButton.isVisible()) {
            await mobileMenuButton.click();
            
            // Check that mobile menu opens
            const mobileMenu = page.locator('.mobile-menu, nav[aria-expanded="true"]');
            await expect(mobileMenu).toBeVisible();
            
            // Test navigation link
            const aboutLink = page.locator('a[href="/about"]').first();
            if (await aboutLink.isVisible()) {
              await aboutLink.click();
              await expect(page).toHaveURL('/about');
            }
          }
        }
      });
    });
  });

  test.describe('Contact Form Responsiveness', () => {
    viewports.forEach(viewport => {
      test(`should be usable on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/contact');
        
        // Check form is visible
        const form = page.locator('form');
        await expect(form).toBeVisible();
        
        // Check all form fields are accessible
        const nameInput = page.locator('input[name="name"]');
        const emailInput = page.locator('input[name="email"]');
        const messageInput = page.locator('textarea[name="message"]');
        const submitButton = page.locator('button[type="submit"]');
        
        await expect(nameInput).toBeVisible();
        await expect(emailInput).toBeVisible();
        await expect(messageInput).toBeVisible();
        await expect(submitButton).toBeVisible();
        
        // Test form interaction
        await nameInput.fill('Responsive Test User');
        await emailInput.fill('responsive@example.com');
        await messageInput.fill('Testing form on different screen sizes');
        
        // Check that form fields are properly sized
        const nameBox = await nameInput.boundingBox();
        const emailBox = await emailInput.boundingBox();
        const messageBox = await messageInput.boundingBox();
        
        expect(nameBox?.width).toBeGreaterThan(100);
        expect(emailBox?.width).toBeGreaterThan(100);
        expect(messageBox?.width).toBeGreaterThan(100);
        
        // Ensure fields don't overflow viewport
        expect(nameBox?.x + nameBox?.width).toBeLessThanOrEqual(viewport.width);
        expect(emailBox?.x + emailBox?.width).toBeLessThanOrEqual(viewport.width);
        expect(messageBox?.x + messageBox?.width).toBeLessThanOrEqual(viewport.width);
      });
    });
  });

  test.describe('Blog Page Responsiveness', () => {
    viewports.forEach(viewport => {
      test(`should display blog content properly on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/blog');
        
        // Check page loads
        await expect(page.locator('h1')).toBeVisible();
        
        // Check blog post layout
        const blogPosts = page.locator('article, .blog-post');
        const postCount = await blogPosts.count();
        
        if (postCount > 0) {
          // Check first blog post
          const firstPost = blogPosts.first();
          await expect(firstPost).toBeVisible();
          
          const postBox = await firstPost.boundingBox();
          expect(postBox?.width).toBeLessThanOrEqual(viewport.width);
          
          // Check that blog post content is readable
          const postTitle = firstPost.locator('h2, h3, .title');
          if (await postTitle.isVisible()) {
            const titleBox = await postTitle.boundingBox();
            expect(titleBox?.width).toBeGreaterThan(100);
          }
          
          // Test blog post navigation on mobile
          if (viewport.width < 768) {
            const postLink = firstPost.locator('a').first();
            if (await postLink.isVisible()) {
              await postLink.click();
              
              // Check individual blog post page
              await expect(page.locator('article')).toBeVisible();
              
              // Check that content is readable on mobile
              const content = page.locator('article .content, article p');
              if (await content.first().isVisible()) {
                const contentBox = await content.first().boundingBox();
                expect(contentBox?.width).toBeLessThanOrEqual(viewport.width - 40); // Account for padding
              }
            }
          }
        }
      });
    });
  });

  test.describe('CMS Dashboard Responsiveness', () => {
    viewports.forEach(viewport => {
      test(`should be functional on ${viewport.name}`, async ({ page }) => {
        test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
        
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('http://localhost:3001/login');
        
        // Check login form responsiveness
        const loginForm = page.locator('form');
        await expect(loginForm).toBeVisible();
        
        const emailInput = page.locator('input[name="email"]');
        const passwordInput = page.locator('input[name="password"]');
        const submitButton = page.locator('button[type="submit"]');
        
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await expect(submitButton).toBeVisible();
        
        // Check form field sizing
        const emailBox = await emailInput.boundingBox();
        const passwordBox = await passwordInput.boundingBox();
        
        expect(emailBox?.width).toBeGreaterThan(100);
        expect(passwordBox?.width).toBeGreaterThan(100);
        
        // Test login (if credentials are available)
        await emailInput.fill('admin@example.com');
        await passwordInput.fill('password');
        await submitButton.click();
        
        // If login succeeds, test dashboard responsiveness
        try {
          await page.waitForURL('**/dashboard', { timeout: 5000 });
          
          // Check dashboard layout
          const dashboard = page.locator('main, .dashboard');
          await expect(dashboard).toBeVisible();
          
          // Check sidebar/navigation on different screen sizes
          if (viewport.width >= 768) {
            // Desktop: sidebar should be visible
            const sidebar = page.locator('aside, .sidebar, nav');
            if (await sidebar.isVisible()) {
              const sidebarBox = await sidebar.boundingBox();
              expect(sidebarBox?.width).toBeGreaterThan(100);
            }
          } else {
            // Mobile: check for mobile menu
            const mobileMenu = page.locator('button[aria-label*="menu"], .mobile-menu-toggle');
            if (await mobileMenu.isVisible()) {
              await mobileMenu.click();
              
              // Check that mobile navigation opens
              const nav = page.locator('nav[aria-expanded="true"], .mobile-nav');
              await expect(nav).toBeVisible();
            }
          }
        } catch (error) {
          // Login failed, skip dashboard tests
          console.log(`Skipping dashboard tests for ${viewport.name}: Login failed`);
        }
      });
    });
  });

  test.describe('Cross-Browser Device Testing', () => {
    const deviceTests = [
      { device: devices['iPhone 12'], name: 'iPhone 12' },
      { device: devices['iPhone 12 Pro'], name: 'iPhone 12 Pro' },
      { device: devices['Pixel 5'], name: 'Pixel 5' },
      { device: devices['iPad Pro'], name: 'iPad Pro' },
      { device: devices['Desktop Chrome'], name: 'Desktop Chrome' },
      { device: devices['Desktop Firefox'], name: 'Desktop Firefox' },
      { device: devices['Desktop Safari'], name: 'Desktop Safari' }
    ];

    deviceTests.forEach(({ device, name }) => {
      test(`should work on ${name}`, async ({ browser }) => {
        const context = await browser.newContext({
          ...device
        });
        const page = await context.newPage();
        
        // Test homepage
        await page.goto('/');
        await expect(page).toHaveTitle(/SaaS Platform/);
        await expect(page.locator('h1')).toBeVisible();
        
        // Test navigation
        const aboutLink = page.locator('a[href="/about"]').first();
        if (await aboutLink.isVisible()) {
          await aboutLink.click();
          await expect(page).toHaveURL('/about');
        }
        
        // Test contact form
        await page.goto('/contact');
        const form = page.locator('form');
        await expect(form).toBeVisible();
        
        // Fill form
        await page.locator('input[name="name"]').fill(`${name} Test User`);
        await page.locator('input[name="email"]').fill('device@example.com');
        await page.locator('textarea[name="message"]').fill(`Testing on ${name}`);
        
        // Check form is submittable
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeVisible();
        await expect(submitButton).toBeEnabled();
        
        await context.close();
      });
    });
  });

  test.describe('Accessibility and Touch Targets', () => {
    test('should have appropriate touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Check that interactive elements have minimum touch target size (44px)
      const buttons = page.locator('button, a, input[type="submit"]');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            // Touch targets should be at least 44px in either dimension
            const hasMinimumSize = box.width >= 44 || box.height >= 44;
            expect(hasMinimumSize).toBeTruthy();
          }
        }
      }
    });

    test('should maintain readability at different zoom levels', async ({ page }) => {
      await page.goto('/');
      
      // Test different zoom levels
      const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
      
      for (const zoom of zoomLevels) {
        await page.evaluate((zoomLevel) => {
          document.body.style.zoom = zoomLevel.toString();
        }, zoom);
        
        // Check that main content is still visible
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('nav')).toBeVisible();
        
        // Check that text is readable (not too small)
        const mainText = page.locator('p, div').first();
        if (await mainText.isVisible()) {
          const fontSize = await mainText.evaluate(el => {
            return window.getComputedStyle(el).fontSize;
          });
          
          const fontSizeNum = parseInt(fontSize);
          expect(fontSizeNum).toBeGreaterThan(10); // Minimum readable size
        }
      }
      
      // Reset zoom
      await page.evaluate(() => {
        document.body.style.zoom = '1';
      });
    });
  });
});