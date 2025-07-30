import { test, expect } from '@playwright/test';

test.describe('CMS Authentication', () => {
  test('should show login page for unauthenticated users', async ({ page }) => {
    await page.goto('http://localhost:3001/dashboard');
    
    // Should redirect to login or show login form
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('should handle login form validation', async ({ page }) => {
    await page.goto('http://localhost:3001/login');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Should show validation errors
    await expect(page.locator('text=required')).toBeVisible();
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.goto('http://localhost:3001/login');
    
    // Fill form with invalid credentials
    await page.locator('input[name="email"]').fill('invalid@example.com');
    await page.locator('input[name="password"]').fill('wrongpassword');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Should show error message
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 10000 });
  });
});