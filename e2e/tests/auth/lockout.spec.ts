/**
 * Account Lockout Tests
 *
 * Lockout (5 failed attempts → 15 min block) is always enforced. This suite
 * always runs against a freshly registered user so no seeded account is ever
 * locked.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { API_URL, TEST_PASSWORD } from '../../helpers/constants.js';

/**
 * Assigned in `beforeAll`, not at module scope.
 *
 * `pid + Date.now()` is unique per worker but constant for the lifetime of a
 * loaded module, so any second `beforeAll` in the same worker re-registered the
 * same address and got "A user with this email already exists." (400). A UUID
 * minted per hook run is unique per *invocation*, which is the actual
 * requirement — this suite needs a freshly locked-out account each time, and
 * never needs the address to be stable across runs.
 */
let email = '';
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
    email = `lockout-${randomUUID()}@demo.com`;

    const reg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: 'Lockout Tester', password: TEST_PASSWORD }),
    });
    // Surface the server's message on failure. A bare status assertion here
    // reports "expected [200,201], got 400" and hides which 400 it was —
    // a duplicate email, a rejected password and a schema violation all look
    // identical, so the failure gives you nothing to act on.
    const regBody = await reg.json().catch(() => ({}));
    expect(
      [200, 201],
      `POST /auth/register (${email}) → ${reg.status}: ${JSON.stringify(regBody)}`,
    ).toContain(reg.status);

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