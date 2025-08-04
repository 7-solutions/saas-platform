import { test, expect } from '@playwright/test';

test.describe('CMS Content Management (Docker)', () => {
  const CMS_URL = process.env.CMS_URL || 'http://localhost:3001';
  
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for Docker environment
    test.setTimeout(90000);
  });

  test('should load CMS login page', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Check for login form elements
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check page title
    await expect(page).toHaveTitle(/login|sign in|cms/i);
    
    await page.screenshot({ path: 'test-results/cms-login.png' });
  });

  test('should handle login form validation', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator('button[type="submit"]');
    
    // Try to submit empty form
    await submitButton.click();
    await page.waitForTimeout(2000);
    
    // Should show validation errors
    const validationMessages = [
      page.locator('text=required').first(),
      page.locator('text=field is required').first(),
      page.locator('[role="alert"]').first(),
      page.locator('.error').first(),
    ];
    
    let foundValidation = false;
    for (const message of validationMessages) {
      if (await message.isVisible({ timeout: 3000 })) {
        foundValidation = true;
        break;
      }
    }
    
    await page.screenshot({ path: 'test-results/cms-login-validation.png' });
    expect(foundValidation).toBe(true);
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Fill form with invalid credentials
    await page.locator('input[name="email"], input[type="email"]').fill('invalid@example.com');
    await page.locator('input[name="password"], input[type="password"]').fill('wrongpassword');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    
    // Should show error message or stay on login page
    const errorIndicators = [
      page.locator('text=invalid').first(),
      page.locator('text=incorrect').first(),
      page.locator('text=failed').first(),
      page.locator('[role="alert"]').first(),
    ];
    
    let foundError = false;
    for (const indicator of errorIndicators) {
      if (await indicator.isVisible({ timeout: 3000 })) {
        foundError = true;
        break;
      }
    }
    
    // If no explicit error message, should still be on login page
    if (!foundError) {
      await expect(page).toHaveURL(/login/);
    }
    
    await page.screenshot({ path: 'test-results/cms-login-error.png' });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto(`${CMS_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/login/);
    
    await page.screenshot({ path: 'test-results/cms-auth-redirect.png' });
  });

  test('should attempt demo login if credentials are available', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Try common demo credentials
    const demoCredentials = [
      { email: 'admin@example.com', password: 'password' },
      { email: 'demo@example.com', password: 'demo' },
      { email: 'test@example.com', password: 'test' },
    ];
    
    for (const creds of demoCredentials) {
      await page.locator('input[name="email"], input[type="email"]').fill(creds.email);
      await page.locator('input[name="password"], input[type="password"]').fill(creds.password);
      
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
      
      // Check if login was successful (redirected away from login page)
      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        // Login successful, test dashboard
        await expect(page).toHaveURL(/dashboard|admin/);
        await page.screenshot({ path: 'test-results/cms-dashboard.png' });
        
        // Test navigation within CMS
        const navLinks = page.locator('nav a, [role="navigation"] a');
        const linkCount = await navLinks.count();
        
        if (linkCount > 0) {
          // Click on first navigation item
          await navLinks.first().click();
          await page.waitForLoadState('networkidle');
          await page.screenshot({ path: 'test-results/cms-navigation.png' });
        }
        
        // Test logout if available
        const logoutButton = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
        if (await logoutButton.isVisible({ timeout: 2000 })) {
          await logoutButton.click();
          await page.waitForLoadState('networkidle');
          await expect(page).toHaveURL(/login/);
        }
        
        return; // Exit test after successful login
      }
      
      // Clear form for next attempt
      await page.locator('input[name="email"], input[type="email"]').fill('');
      await page.locator('input[name="password"], input[type="password"]').fill('');
    }
    
    // If no demo credentials worked, that's expected
    console.log('No demo credentials available - this is expected in production');
  });

  test('should have proper form accessibility', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Check for proper labels
    const emailInput = page.locator('input[name="email"], input[type="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"]');
    
    // Check that inputs have labels or aria-labels
    const emailLabel = await emailInput.getAttribute('aria-label') || 
                      await page.locator('label[for="email"]').textContent() ||
                      await page.locator('label').filter({ has: emailInput }).textContent();
    
    const passwordLabel = await passwordInput.getAttribute('aria-label') || 
                         await page.locator('label[for="password"]').textContent() ||
                         await page.locator('label').filter({ has: passwordInput }).textContent();
    
    expect(emailLabel).toBeTruthy();
    expect(passwordLabel).toBeTruthy();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    await page.screenshot({ path: 'test-results/cms-accessibility.png' });
  });

  test('should handle page editor if accessible', async ({ page }) => {
    await page.goto(`${CMS_URL}/dashboard/pages`);
    await page.waitForLoadState('networkidle');
    
    // If redirected to login, skip this test
    if (page.url().includes('/login')) {
      test.skip('Authentication required for page editor test');
      return;
    }
    
    // Look for page creation or editing interface
    const createButton = page.locator('button, a').filter({ hasText: /create|new|add/i }).first();
    
    if (await createButton.isVisible({ timeout: 5000 })) {
      await createButton.click();
      await page.waitForLoadState('networkidle');
      
      // Look for page editor form
      const titleInput = page.locator('input[name="title"], input[placeholder*="title"]');
      const contentArea = page.locator('textarea, [contenteditable="true"], .editor');
      
      if (await titleInput.isVisible({ timeout: 5000 })) {
        await titleInput.fill('E2E Test Page');
        
        if (await contentArea.isVisible({ timeout: 5000 })) {
          await contentArea.fill('This is a test page created by E2E tests.');
        }
        
        await page.screenshot({ path: 'test-results/cms-page-editor.png' });
        
        // Look for save button
        const saveButton = page.locator('button').filter({ hasText: /save|publish/i }).first();
        if (await saveButton.isVisible({ timeout: 3000 })) {
          await saveButton.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: 'test-results/cms-page-saved.png' });
        }
      }
    }
  });

  test('should handle media upload interface', async ({ page }) => {
    await page.goto(`${CMS_URL}/dashboard/media`);
    await page.waitForLoadState('networkidle');
    
    // If redirected to login, skip this test
    if (page.url().includes('/login')) {
      test.skip('Authentication required for media upload test');
      return;
    }
    
    // Look for media upload interface
    const uploadButton = page.locator('button, input[type="file"]').filter({ hasText: /upload/i }).first();
    const fileInput = page.locator('input[type="file"]');
    
    if (await uploadButton.isVisible({ timeout: 5000 }) || await fileInput.isVisible({ timeout: 5000 })) {
      await page.screenshot({ path: 'test-results/cms-media-upload.png' });
      
      // Test drag and drop area if present
      const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, .upload-area');
      if (await dropZone.isVisible({ timeout: 3000 })) {
        await expect(dropZone).toBeVisible();
      }
    }
  });

  test('should have responsive CMS interface', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1024, height: 768, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      // Check that login form is still visible and usable
      await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      await page.screenshot({ path: `test-results/cms-${viewport.name}-view.png` });
    }
  });
});