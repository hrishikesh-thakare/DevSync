/**
 * Auth — Session Management Tests
 * @tags @auth
 */
import { test, expect } from '@playwright/test';
import { ROUTES, TEST_USERS, API_URL, TEST_PASSWORD } from '../../helpers/constants.js';
import { apiRequest } from '../../helpers/api-helpers.js';

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

  test('GET /auth/me returns current user', async () => {
    // We need to login via raw fetch to get the access token
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USERS.owner.email, password: TEST_PASSWORD })
    });
    const { accessToken } = await loginRes.json();

    const { status, data } = await apiRequest('/auth/me', accessToken);
    expect(status).toBe(200);
    expect(data?.user?.email).toBe(TEST_USERS.owner.email);
  });

  test('refresh rotates token', async () => {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USERS.owner.email, password: TEST_PASSWORD })
    });
    const { accessToken: oldToken } = await loginRes.json();
    const cookies = loginRes.headers.get('set-cookie');
    if (!cookies) throw new Error('No set-cookie header');

    // Wait 1 sec so iat timestamp changes in token signature
    await new Promise((r) => setTimeout(r, 1000));

    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': cookies }
    });
    expect(refreshRes.status).toBe(200);
    const { accessToken: newToken } = await refreshRes.json();
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(oldToken);
  });

  test('logout revokes refresh token', async () => {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USERS.owner.email, password: TEST_PASSWORD })
    });
    const cookies = loginRes.headers.get('set-cookie');
    if (!cookies) throw new Error('No set-cookie header');

    const logoutRes = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': cookies }
    });
    expect(logoutRes.status).toBe(200);

    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': cookies } // Using old cookie which is now revoked
    });
    expect(refreshRes.status).toBe(401);
  });
});
