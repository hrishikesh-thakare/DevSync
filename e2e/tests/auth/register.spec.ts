/**
 * Auth — Registration Flow Tests
 * @tags @auth
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from '../../helpers/constants.js';

test.describe('Registration Flow @auth', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTES.register);
  });

  test('should display the registration form', async ({ page }) => {
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account|sign up|register/i })).toBeVisible();
  });

  test('should register a new user with valid details', async ({ page }) => {
    const uniqueEmail = `e2e-test-${Date.now()}@demo.com`;

    // Fill in the name field (look for it by label or placeholder)
    const nameInput = page.locator('input[type="text"]');
    await nameInput.fill('E2E Test User');

    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    // Should redirect to workspaces after successful registration
    await expect(page).toHaveURL(/\/workspaces/, { timeout: 15_000 });
  });

  test('should show error for already-registered email', async ({ page }) => {
    // Fill name if present
    const nameInput = page.locator('input[type="text"]');
    await nameInput.fill('Duplicate User');

    await page.locator('input[type="email"]').fill('alice@demo.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    // Should show error
    await expect(page.locator('.text-red-400, [class*="error"], [class*="red"]')).toBeVisible({ timeout: 10_000 });
  });

  test('should have link to login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /sign in|log in|login/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
