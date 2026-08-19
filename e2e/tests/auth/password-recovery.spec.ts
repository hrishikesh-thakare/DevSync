/**
 * Password Recovery & Email Verification Tests
 *
 * Covers the full recovery path: change-password while logged in,
 * forgot-password -> reset-password via emailed token, and email
 * verification on registration. All flows run against freshly registered
 * users so no seeded account is ever affected.
 *
 * NOTE: in non-production environments the reset/verification links are
 * returned in the API response (no SMTP configured in CI); production only
 * ever delivers them by email.
 */
import { test, expect } from '@playwright/test';
import { API_URL, TEST_PASSWORD } from '../../helpers/constants.js';
import { verifyEmail } from '../../helpers/api-helpers.js';

async function api(path: string, body: unknown, token?: string) {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function registerUser(email: string) {
  const res = await api('/auth/register', {
    email,
    fullName: 'Recovery Tester',
    password: TEST_PASSWORD,
  });
  expect([200, 201]).toContain(res.status);
  const body = await res.json();
  expect(body.accessToken).toBeTruthy();
  return body as { accessToken: string; verificationUrl?: string };
}

function tokenFromUrl(url: string): string {
  return new URL(url).searchParams.get('token')!;
}

test.describe('Change Password', () => {
  // process.pid keeps emails unique across parallel workers (module-scope
  // Date.now() is identical in every worker and caused registration races).
  const email = `change-pw-${process.pid}-${Date.now()}@demo.com`;
  const newPassword = 'NewPassword456!';
  let accessToken: string;

  test.beforeAll(async () => {
    const body = await registerUser(email);
    accessToken = body.accessToken;
    await verifyEmail(body);
  });

  test('requires authentication', async () => {
    const res = await api('/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword });
    expect(res.status).toBe(401);
  });

  test('rejects an incorrect current password', async () => {
    const res = await api('/auth/change-password', { currentPassword: 'WrongPassword123!', newPassword }, accessToken);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Current password is incorrect.');
  });

  test('rejects a weak new password', async () => {
    const res = await api('/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: 'weak' }, accessToken);
    expect(res.status).toBe(400);
  });

  test('changes the password and invalidates the old one', async () => {
    const res = await api('/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword }, accessToken);
    expect(res.status).toBe(200);

    const oldLogin = await api('/auth/login', { email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api('/auth/login', { email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });
});

test.describe('Forgot / Reset Password', () => {
  const email = `forgot-pw-${process.pid}-${Date.now()}@demo.com`;
  const newPassword = 'RecoveredPassword789!';

  test.beforeAll(async () => {
    const body = await registerUser(email);
    await verifyEmail(body);
  });

  test('does not leak whether an email has an account', async () => {
    const res = await api('/auth/forgot-password', { email: `nobody-${Date.now()}@demo.com` });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('If an account exists');
    expect(body.resetUrl).toBeUndefined();
  });

  test('issues a reset token for an existing account', async () => {
    const res = await api('/auth/forgot-password', { email });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resetUrl).toBeTruthy();
  });

  test('rejects a garbage reset token', async () => {
    const res = await api('/auth/reset-password', { token: 'not-a-real-token', newPassword });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid or expired reset token');
  });

  test('resets the password and signs out every session', async () => {
    const forgot = await api('/auth/forgot-password', { email });
    const resetUrl = (await forgot.json()).resetUrl as string;
    const token = tokenFromUrl(resetUrl);

    const loginBefore = await api('/auth/login', { email, password: TEST_PASSWORD });
    expect(loginBefore.status).toBe(200);
    const refreshCookie = loginBefore.headers.get('set-cookie')?.split(';')[0];

    const res = await api('/auth/reset-password', { token, newPassword });
    expect(res.status).toBe(200);

    // Old password no longer works, new one does
    const oldLogin = await api('/auth/login', { email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await api('/auth/login', { email, password: newPassword });
    expect(newLogin.status).toBe(200);

    // Pre-reset refresh token was revoked
    const refresh = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: refreshCookie! },
    });
    expect(refresh.status).toBe(401);
  });

  test('reset token is single-use', async () => {
    const forgot = await api('/auth/forgot-password', { email });
    const resetUrl = (await forgot.json()).resetUrl as string;
    const token = tokenFromUrl(resetUrl);

    const first = await api('/auth/reset-password', { token, newPassword: 'AnotherPass123!' });
    expect(first.status).toBe(200);

    const second = await api('/auth/reset-password', { token, newPassword: 'YetAnotherPass123!' });
    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.error).toContain('Invalid or expired reset token');
  });
});

test.describe('Email Verification', () => {
  const email = `verify-${process.pid}-${Date.now()}@demo.com`;

  test('registration issues a verification token', async () => {
    const { verificationUrl } = await registerUser(email);
    expect(verificationUrl).toBeTruthy();
  });

  test('rejects a garbage verification token', async () => {
    const res = await api('/auth/verify-email', { token: 'not-a-real-token' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid or expired verification token');
  });

  test('verifies the email address', async () => {
    const { verificationUrl } = await registerUser(`verify-2-${Date.now()}@demo.com`);
    const res = await api('/auth/verify-email', { token: tokenFromUrl(verificationUrl) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('verified');
  });

  test('verification token is single-use', async () => {
    const { verificationUrl } = await registerUser(`verify-3-${Date.now()}@demo.com`);
    const token = tokenFromUrl(verificationUrl);

    const first = await api('/auth/verify-email', { token });
    expect(first.status).toBe(200);

    const second = await api('/auth/verify-email', { token });
    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.error).toContain('Invalid or expired verification token');
  });

  test('login is blocked until the email is verified, then succeeds', async () => {
    const email = `enforce-${process.pid}-${Date.now()}@demo.com`;
    const { verificationUrl } = await registerUser(email);

    // Correct password, unverified account → 403 (REQUIRE_EMAIL_VERIFICATION)
    const blocked = await api('/auth/login', { email, password: TEST_PASSWORD });
    expect(blocked.status).toBe(403);

    const verify = await api('/auth/verify-email', { token: tokenFromUrl(verificationUrl) });
    expect(verify.status).toBe(200);

    // After verification the same credentials sign in normally
    const allowed = await api('/auth/login', { email, password: TEST_PASSWORD });
    expect(allowed.status).toBe(200);
  });
});