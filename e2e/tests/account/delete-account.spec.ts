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

  // Regression for the dead end this used to be: register, delete, register
  // again with the same address. Before the fix, `register` checked for an
  // existing email without filtering `deleted_at`, so this second attempt got
  // "a user with this email already exists" while `login` (which did filter)
  // said "invalid email or password" — no way back in, ever, for that address.
  test('can re-register with the email of a deleted account', async () => {
    const email = `re_register_${Date.now()}@demo.com`;
    await registerAndVerify(email);

    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const { accessToken } = await loginRes.json();

    const del = await apiRequest('/auth/me', accessToken, { method: 'DELETE' });
    expect(del.status).toBe(200);

    const reRegisterRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: 'Reborn', password: TEST_PASSWORD }),
    });
    expect(reRegisterRes.status).toBe(201);

    // The new account is a genuinely new row, not a resurrection of the old
    // one — it starts unverified again, same as any other signup.
    const reRegisterBody = await reRegisterRes.json();
    expect(reRegisterBody.verificationUrl).toBeTruthy();

    // Verify the new account's email and log in. This is the step that would
    // break if `login` returned the soft-deleted row instead of the live one —
    // it would see `deletedAt` and reject with 401.
    const reVerifyUrl = new URL(reRegisterBody.verificationUrl);
    const reVerifyToken = reVerifyUrl.searchParams.get('token');
    const verifyRes = await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: reVerifyToken }),
    });
    expect(verifyRes.ok).toBe(true);

    const reLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    expect(reLoginRes.status).toBe(200);
    const reLoginBody = await reLoginRes.json();
    expect(reLoginBody.accessToken).toBeTruthy();
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

    // Go to Account Settings — the "Account" tab holds the delete card
    await page.goto('/account');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Account' }).click();

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
