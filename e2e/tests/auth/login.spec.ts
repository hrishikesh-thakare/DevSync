/**
 * Auth — Login Flow Tests
 * @tags @auth
 */
import { test, expect } from '@playwright/test';
import { ROUTES, TEST_USERS, TEST_PASSWORD } from '../../helpers/constants.js';

test.describe('Login Flow @auth', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTES.login);
  });

  test('should display the login form', async ({ page }) => {
    await expect(page.getByText('Sign in to your workspace')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const user = TEST_USERS.owner;

    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to workspace picker
    await expect(page).toHaveURL(/\/workspaces/, { timeout: 15_000 });

    // JWT should be stored in localStorage
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();
  });

  test('should show error for wrong password', async ({ page }) => {
    await page.locator('input[type="email"]').fill(TEST_USERS.owner.email);
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message and stay on login page
    await expect(page.locator('.text-red-400, [class*="error"], [class*="red"]')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for non-existent email', async ({ page }) => {
    await page.locator('input[type="email"]').fill('doesnotexist@test.com');
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.locator('.text-red-400, [class*="error"], [class*="red"]')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show OAuth buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('should have link to register page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /create an account/i })).toBeVisible();
    await page.getByRole('link', { name: /create an account/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});
