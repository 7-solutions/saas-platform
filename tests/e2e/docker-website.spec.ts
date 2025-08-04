import { test, expect } from '@playwright/test';

test.describe('Website E2E Tests (Docker)', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for Docker environment
    test.setTimeout(60000);
  });

  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check that the page loads with correct title
    await expect(page).toHaveTitle(/SaaS/i);
    
    // Check for main content
    await expect(page.locator('main')).toBeVisible();
    
    // Check for navigation
    await expect(page.locator('nav')).toBeVisible();
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/homepage.png' });
  });

  test('should have responsive design', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('nav')).toBeVisible();
    await page.screenshot({ path: 'test-results/desktop-view.png' });
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('nav')).toBeVisible();
    await page.screenshot({ path: 'test-results/tablet-view.png' });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('nav')).toBeVisible();
    await page.screenshot({ path: 'test-results/mobile-view.png' });
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test navigation to About page
    const aboutLink = page.locator('a').filter({ hasText: /about/i }).first();
    if (await aboutLink.isVisible()) {
      await aboutLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/about/);
      await page.screenshot({ path: 'test-results/about-page.png' });
    }
    
    // Test navigation to Services page
    await page.goto('/');
    const servicesLink = page.locator('a').filter({ hasText: /services/i }).first();
    if (await servicesLink.isVisible()) {
      await servicesLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/services/);
      await page.screenshot({ path: 'test-results/services-page.png' });
    }
    
    // Test navigation to Contact page
    await page.goto('/');
    const contactLink = page.locator('a').filter({ hasText: /contact/i }).first();
    if (await contactLink.isVisible()) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/contact/);
      await page.screenshot({ path: 'test-results/contact-page.png' });
    }
  });

  test('should handle contact form submission', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Check if contact form exists
    const nameInput = page.locator('input[name="name"], input[id="name"]');
    const emailInput = page.locator('input[name="email"], input[id="email"]');
    const messageInput = page.locator('textarea[name="message"], textarea[id="message"]');
    const submitButton = page.locator('button[type="submit"]');
    
    if (await nameInput.isVisible()) {
      // Fill out the form
      await nameInput.fill('E2E Test User');
      await emailInput.fill('e2e-test@example.com');
      await messageInput.fill('This is an end-to-end test message from Playwright running in Docker.');
      
      // Take screenshot before submission
      await page.screenshot({ path: 'test-results/contact-form-filled.png' });
      
      // Submit the form
      await submitButton.click();
      
      // Wait for response (success message or redirect)
      await page.waitForTimeout(3000);
      
      // Check for success indicators
      const successIndicators = [
        page.locator('text=thank you').first(),
        page.locator('text=message sent').first(),
        page.locator('text=success').first(),
        page.locator('[data-testid="success"]').first(),
      ];
      
      let foundSuccess = false;
      for (const indicator of successIndicators) {
        if (await indicator.isVisible({ timeout: 5000 })) {
          foundSuccess = true;
          break;
        }
      }
      
      // Take screenshot after submission
      await page.screenshot({ path: 'test-results/contact-form-submitted.png' });
      
      // If no success message found, check that form was at least processed
      if (!foundSuccess) {
        // Form should be reset or show some change
        const nameValue = await nameInput.inputValue();
        expect(nameValue).toBe(''); // Form should be cleared on success
      }
    }
  });

  test('should handle form validation', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator('button[type="submit"]');
    
    if (await submitButton.isVisible()) {
      // Try to submit empty form
      await submitButton.click();
      
      // Wait for validation messages
      await page.waitForTimeout(1000);
      
      // Check for validation errors
      const validationMessages = [
        page.locator('text=required').first(),
        page.locator('text=field is required').first(),
        page.locator('[role="alert"]').first(),
        page.locator('.error').first(),
      ];
      
      let foundValidation = false;
      for (const message of validationMessages) {
        if (await message.isVisible({ timeout: 2000 })) {
          foundValidation = true;
          break;
        }
      }
      
      // Take screenshot of validation state
      await page.screenshot({ path: 'test-results/form-validation.png' });
      
      expect(foundValidation).toBe(true);
    }
  });

  test('should load and display blog posts', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');
    
    // Check if blog page exists and loads
    if (await page.locator('h1').isVisible()) {
      await expect(page.locator('h1')).toContainText(/blog/i);
      
      // Check for blog post listings
      const blogPosts = page.locator('article, .blog-post, [data-testid="blog-post"]');
      
      if (await blogPosts.first().isVisible({ timeout: 5000 })) {
        const postCount = await blogPosts.count();
        expect(postCount).toBeGreaterThan(0);
        
        // Click on first blog post if available
        await blogPosts.first().click();
        await page.waitForLoadState('networkidle');
        
        // Should navigate to individual blog post
        await expect(page).toHaveURL(/blog\/.+/);
      }
      
      await page.screenshot({ path: 'test-results/blog-page.png' });
    }
  });

  test('should have proper SEO elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for essential SEO elements
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    
    // Check for meta description
    const metaDescription = page.locator('meta[name="description"]');
    if (await metaDescription.count() > 0) {
      const content = await metaDescription.getAttribute('content');
      expect(content?.length).toBeGreaterThan(0);
    }
    
    // Check for proper heading structure
    const h1 = page.locator('h1');
    if (await h1.count() > 0) {
      expect(await h1.count()).toBe(1); // Should have exactly one H1
    }
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const img = images.nth(i);
      if (await img.isVisible()) {
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    }
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    // Navigate to a non-existent page
    const response = await page.goto('/non-existent-page-12345');
    
    // Should return 404 status
    expect(response?.status()).toBe(404);
    
    // Should show custom 404 page
    await expect(page.locator('h1')).toContainText(/404|not found/i);
    
    // Should have navigation back to home
    const homeLink = page.locator('a[href="/"], a').filter({ hasText: /home/i }).first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/');
    }
    
    await page.screenshot({ path: 'test-results/404-page.png' });
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for keyboard navigation
    await page.keyboard.press('Tab');
    
    // Check that focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Check for ARIA labels on navigation
    const navLinks = page.locator('nav a');
    const linkCount = await navLinks.count();
    
    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const link = navLinks.nth(i);
      const text = await link.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});