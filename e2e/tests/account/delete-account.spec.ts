import { test, expect } from '../../fixtures/test-fixtures.js';
import { apiRequest } from '../../helpers/api-helpers.js';
import { API_URL, TEST_PASSWORD } from '../../helpers/constants.js';

test.describe('Self-Service Account Deletion @account', () => {
  const registerAndVerify = async (email: string) => {
    // Register
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: 'To Be Deleted', password: TEST_PASSWORD }),
    });
    expect(regRes.ok).toBe(true);
    
    // Verify email
    const regBody = await regRes.json();
    const verificationUrl = new URL(regBody.verificationUrl);
    const verifyToken = verificationUrl.searchParams.get('token');
    await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });
  };

  test('can delete own account via API and gets logged out', async () => {
    const email = `api_delete_${Date.now()}@demo.com`;
    await registerAndVerify(email);

    // Login via API
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const { accessToken } = await loginRes.json();

    // Delete account
    const { status } = await apiRequest('/auth/me', accessToken, { method: 'DELETE' });
    expect(status).toBe(200);

    // Verify token is no longer valid
    const { status: meStatus } = await apiRequest('/auth/me', accessToken);
    expect(meStatus).toBe(401);
  });

  test('can delete own account via UI (Account Settings)', async ({ page }) => {
    const email = `ui_delete_${Date.now()}@demo.com`;
    await registerAndVerify(email);

    // Navigate and login
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/workspaces');

    // Go to Account Settings
    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    // Click "Delete account" trigger
    await page.click('button:has-text("Delete account")');

    // Modal is open, type email to confirm
    const confirmDialog = page.locator('[role="alertdialog"]');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.locator('input').fill(email);

    // Click Delete permanently
    await confirmDialog.locator('button:has-text("Delete permanently")').click();

    // Should redirect to login and show success toast
    await page.waitForURL('/login');
    await expect(page.locator('text=Account deleted successfully')).toBeVisible();

    // Trying to log in again should fail
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid email or password.')).toBeVisible();
  });
});
