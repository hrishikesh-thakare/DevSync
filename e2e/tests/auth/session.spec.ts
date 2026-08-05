/**
 * Auth — Session Management Tests
 * @tags @auth
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from '../../helpers/constants.js';

test.describe('Session Management @auth', () => {
  test('should redirect unauthenticated user to login when accessing protected route', async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('accessToken'));

    // Try to access a protected route
    await page.goto(ROUTES.workspaces);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('should redirect unauthenticated user accessing workspace route', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('accessToken'));

    await page.goto('/w/e2e-test-workspace');

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('should allow authenticated user to access workspace picker', async ({ page }) => {
    // Use the owner's saved auth state via storageState
    const fs = await import('fs');
    const path = await import('path');

    // Load owner auth state
    const authPath = path.resolve(import.meta.dirname, '../../.auth/owner.json');
    if (!fs.existsSync(authPath)) {
      test.skip();
      return;
    }

    const context = await page.context().browser()!.newContext({ storageState: authPath });
    const authPage = await context.newPage();

    await authPage.goto(ROUTES.workspaces);
    await expect(authPage).not.toHaveURL(/\/login/, { timeout: 10_000 });

    await context.close();
  });
});
