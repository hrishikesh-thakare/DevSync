/**
 * Account Lockout Tests
 *
 * Lockout (5 failed attempts → 15 min block) is always enforced. This suite
 * always runs against a freshly registered user so no seeded account is ever
 * locked.
 */
import { test, expect } from '@playwright/test';
import { API_URL, TEST_PASSWORD } from '../../helpers/constants.js';

// process.pid keeps the email unique across parallel workers: module-scope
// Date.now() is identical in every worker and caused registration races.
const email = `lockout-${process.pid}-${Date.now()}@demo.com`;
const wrongPassword = 'WrongPassword123!';

async function loginAttempt(mail: string, password: string) {
  return fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password }),
  });
}

test.describe('Account Lockout', () => {
  test.beforeAll(async () => {
    const reg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: 'Lockout Tester', password: TEST_PASSWORD }),
    });
    expect([200, 201]).toContain(reg.status);

    // 5 failed attempts must all return 401 without leaking state
    for (let i = 0; i < 5; i++) {
      const res = await loginAttempt(email, wrongPassword);
      expect(res.status).toBe(401);
      const body = await res.json().catch(() => ({}));
      expect(body.error).toBe('Invalid email or password.');
    }
  });

  test('account is locked after 5 failed attempts', async () => {
    const res = await loginAttempt(email, TEST_PASSWORD);
    expect(res.status).toBe(423);
    const body = await res.json();
    expect(body.error).toContain('Account temporarily locked');
    expect(body.error).toMatch(/try again in \d+ minute/i);
  });

  test('failed attempts report a generic error (no user enumeration)', async () => {
    const res = await loginAttempt(`nonexistent-${Date.now()}@demo.com`, wrongPassword);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid email or password.');
  });

  test('lockout also rejects the wrong password with 423', async () => {
    const res = await loginAttempt(email, wrongPassword);
    expect(res.status).toBe(423);
  });
});