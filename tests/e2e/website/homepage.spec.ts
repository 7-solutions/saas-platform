import { test, expect } from '@playwright/test';

test.describe('Website Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/SaaS Platform/);
    
    // Check for main navigation
    await expect(page.locator('nav')).toBeVisible();
    
    // Check for hero section
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have responsive navigation', async ({ page }) => {
    await page.goto('/');
    
    // Test desktop navigation
    await expect(page.locator('nav')).toBeVisible();
    
    // Test mobile navigation (if applicable)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate to different pages', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation to About page
    const aboutLink = page.locator('a[href="/about"]').first();
    if (await aboutLink.isVisible()) {
      await aboutLink.click();
      await expect(page).toHaveURL('/about');
    }
    
    // Navigate back to home
    await page.goto('/');
    
    // Test navigation to Services page
    const servicesLink = page.locator('a[href="/services"]').first();
    if (await servicesLink.isVisible()) {
      await servicesLink.click();
      await expect(page).toHaveURL('/services');
    }
  });

  test('should have working contact form', async ({ page }) => {
    await page.goto('/contact');
    
    // Fill out contact form if it exists
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    const messageInput = page.locator('textarea[name="message"]');
    const submitButton = page.locator('button[type="submit"]');
    
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test User');
      await emailInput.fill('test@example.com');
      await messageInput.fill('This is a test message');
      
      // Submit form
      await submitButton.click();
      
      // Check for success message or redirect
      await expect(page.locator('text=Thank you')).toBeVisible({ timeout: 10000 });
    }
  });
});