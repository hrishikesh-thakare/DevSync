/**
 * Password Recovery — UI Flow Tests
 *
 * Exercises the recovery screens end-to-end in the browser: the
 * forgot-password page, the reset-password page with a real token, and the
 * change-password form on the account settings page. Fresh users only, so no
 * seeded account is ever touched.
 */
import { test, expect } from '@playwright/test';
import { API_URL, TEST_PASSWORD } from '../../helpers/constants.js';
import { verifyEmail } from '../../helpers/api-helpers.js';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const newPassword = 'UiRecoveredPass789!';

async function api(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect([200, 201]).toContain(res.status);
  const json = await res.json();
  if (path === '/auth/register' && json.verificationUrl) {
    // REQUIRE_EMAIL_VERIFICATION blocks unverified logins, and this spec
    // signs its fresh users in through the UI.
    await verifyEmail(json);
  }
  return json;
}

test.describe('Password Recovery — UI', () => {
  test('forgot-password page always shows the generic success message', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await page.getByPlaceholder('you@company.com').fill(`nobody-${Date.now()}@demo.com`);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('password reset link has been sent')).toBeVisible();
  });

  test('full reset flow: request → reset page → sign in with new password', async ({ page }) => {
    const email = `ui-reset-${Date.now()}@demo.com`;
    await api('/auth/register', { email, fullName: 'UI Reset Tester', password: TEST_PASSWORD });

    const { resetUrl } = await api('/auth/forgot-password', { email });
    expect(resetUrl).toBeTruthy();

    await page.goto(resetUrl);
    await expect(page.getByText('Choose a new password')).toBeVisible();

    await page.getByPlaceholder('At least 8 characters').fill(newPassword);
    await page.getByPlaceholder('Re-enter new password').fill(newPassword);
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText('Your password has been reset')).toBeVisible();
    await page.getByRole('link', { name: 'Go to sign in' }).click();
    await expect(page).toHaveURL(`${BASE}/login`);

    // Old password is dead
    await page.getByPlaceholder('you@company.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();

    // New password works
    await page.getByPlaceholder('you@company.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(`${BASE}/workspaces`);
  });

  test('account settings: change password signs out other sessions', async ({ page }) => {
    const email = `ui-change-${Date.now()}@demo.com`;
    await api('/auth/register', { email, fullName: 'UI Change Tester', password: TEST_PASSWORD });

    // Sign in
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder('you@company.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(`${BASE}/workspaces`);

    // Change password via the account settings page
    await page.goto(`${BASE}/account`);
    await expect(page.getByText('Change Password')).toBeVisible();

    await page.getByPlaceholder('Enter your current password').fill(TEST_PASSWORD);
    await page.getByPlaceholder('At least 8 characters').fill(newPassword);
    await page.getByPlaceholder('Re-enter new password').fill(newPassword);
    await page.getByRole('button', { name: 'Update Password' }).click();
    await expect(page.getByText('Password changed. Other sessions were signed out.')).toBeVisible();

    // Sign out (revokes the refresh cookie) and back in with the new password
    await page.evaluate(async (apiBase) => {
      await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' });
      localStorage.clear();
    }, API_URL);
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder('you@company.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(`${BASE}/workspaces`);
  });
});