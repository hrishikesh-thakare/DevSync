import { test, expect } from '../../fixtures/test-fixtures.js';
import { apiRequest } from '../../helpers/api-helpers.js';
import { API_URL, TEST_PASSWORD } from '../../helpers/constants.js';

test.describe('Self-Service Account Deletion @account', () => {
  let token: string;
  const email = `delete_me_${Date.now()}@demo.com`;

  test.beforeAll(async () => {
    // Register a new throwaway user
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: 'To Be Deleted', password: TEST_PASSWORD }),
    });
    expect(regRes.ok).toBe(true);
    
    // Verify email (since REQUIRE_EMAIL_VERIFICATION is active in CI)
    const regBody = await regRes.json();
    const verificationUrl = new URL(regBody.verificationUrl);
    const verifyToken = verificationUrl.searchParams.get('token');
    await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });

    // Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const loginBody = await loginRes.json();
    token = loginBody.accessToken;
  });

  test('can delete own account and gets logged out', async () => {
    // Delete account
    const { status } = await apiRequest('/auth/me', token, { method: 'DELETE' });
    expect(status).toBe(200);

    // Verify token is no longer valid
    const { status: meStatus } = await apiRequest('/auth/me', token);
    expect(meStatus).toBe(401);
  });
});
