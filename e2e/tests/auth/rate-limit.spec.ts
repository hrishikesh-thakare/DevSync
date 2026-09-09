/**
 * Rate Limiting Tests
 *
 * The suite's main backend (3001) runs with NODE_ENV=test, where rate
 * limiting is intentionally skipped. The playwright config also starts a
 * production-mode backend on 3002 (TRUST_PROXY_HOPS=1) so the real limiter
 * can be exercised: it must key on the forwarded client IP (X-Forwarded-For)
 * and refuse once the auth window is exhausted.
 */
import { test, expect } from '../../fixtures/test-fixtures.js';

const PROD_API = 'http://localhost:3002/api';

async function loginAttempt(forwardedIp: string, email?: string): Promise<Response> {
  return fetch(`${PROD_API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': forwardedIp,
    },
    body: JSON.stringify({
      // A random email per attempt: the limiter is keyed on IP, and unique
      // emails keep the per-account failed-attempt lockout (5 → 423) from
      // kicking in, so every non-429 response is a plain 401.
      email: email || `rl-${Math.random().toString(36).slice(2)}@demo.com`,
      password: 'WrongPassword123!',
    }),
  });
}

test.describe('Rate limiting', () => {
  test('auth limiter keys on the forwarded IP and blocks at the limit', async () => {
    const ipA = '198.51.100.10';

    // Burn down the 10-request / 15-minute window for this IP.
    for (let i = 0; i < 10; i++) {
      const res = await loginAttempt(ipA);
      expect(res.status, `attempt ${i + 1} should be a plain 401`).toBe(401);
    }

    // The 11th request from the same forwarded IP is refused outright.
    const blocked = await loginAttempt(ipA);
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toContain('Too many authentication attempts');

    // A different forwarded IP has its own untouched bucket: still a 401.
    const fresh = await loginAttempt('198.51.100.99');
    expect(fresh.status).toBe(401);
  });
});
