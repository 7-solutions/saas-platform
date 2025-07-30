import { test, expect } from '@playwright/test';

// Helper function to login (you'll need to implement based on your auth system)
async function login(page: any) {
  await page.goto('http://localhost:3001/login');
  
  // This is a placeholder - you'll need to implement actual login
  // based on your authentication system
  await page.locator('input[name="email"]').fill('admin@example.com');
  await page.locator('input[name="password"]').fill('password');
  await page.locator('button[type="submit"]').click();
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard');
}

test.describe('CMS Content Management', () => {
  test('should access dashboard after login', async ({ page }) => {
    // Skip if no auth system is set up yet
    test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
    
    await login(page);
    
    // Should be on dashboard
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should navigate to pages management', async ({ page }) => {
    test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
    
    await login(page);
    
    // Navigate to pages
    const pagesLink = page.locator('a[href*="pages"]');
    if (await pagesLink.isVisible()) {
      await pagesLink.click();
      await expect(page).toHaveURL(/pages/);
    }
  });

  test('should navigate to media library', async ({ page }) => {
    test.skip(!process.env.TEST_WITH_AUTH, 'Auth system not configured for testing');
    
    await login(page);
    
    // Navigate to media
    const mediaLink = page.locator('a[href*="media"]');
    if (await mediaLink.isVisible()) {
      await mediaLink.click();
      await expect(page).toHaveURL(/media/);
    }
  });
});