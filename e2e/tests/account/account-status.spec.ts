/**
 * Account Status & Preferences Tests
 *
 * Covers the presence / status / preferences endpoints that the rest of the
 * suite never touched:
 *   POST  /auth/status        — set status text + presence
 *   POST  /auth/presence      — set presence
 *   PATCH /auth/preferences   — merge user preferences (jsonb)
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

test.describe('Account Status & Preferences', () => {
  // Each test mutates a DIFFERENT user — the handlers write the same row and
  // would race each other under fullyParallel (UPDATE + re-SELECT inside the
  // handler can interleave and return the other test's value).
  test('POST /auth/status updates statusText and presence', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest('/auth/status', accessToken, {
      method: 'POST',
      body: JSON.stringify({ statusText: 'In a meeting', presence: 'away' }),
    });
    expect(status).toBe(200);
    expect(data.user.presence).toBe('away');
    expect(data.user.statusText).toBe('In a meeting');
  });

  test('POST /auth/presence updates presence', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const { status, data } = await apiRequest('/auth/presence', accessToken, {
      method: 'POST',
      body: JSON.stringify({ presence: 'away' }),
    });
    expect(status).toBe(200);
    expect(data.user.presence).toBe('away');
  });

  /**
   * `users.presence` is an unconstrained varchar with no DB-level check, so the
   * Zod schema on these two routes is the only thing holding the enum. Before
   * it existed the handler wrote whatever arrived — this suite asserted that a
   * presence of 'busy' round-tripped, which is the defect rather than the
   * contract. The client renders exactly three states (design system §3), and
   * anything else would be stored and then silently fall through to the
   * offline fallback.
   */
  test('presence is constrained to the three rendered states', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);

    for (const presence of ['online', 'away', 'offline']) {
      const { status, data } = await apiRequest('/auth/presence', accessToken, {
        method: 'POST',
        body: JSON.stringify({ presence }),
      });
      expect(status, `presence '${presence}' should be accepted`).toBe(200);
      expect(data.user.presence).toBe(presence);
    }

    for (const presence of ['busy', 'BUSY', '', 'online ', 'dnd']) {
      const { status } = await apiRequest('/auth/presence', accessToken, {
        method: 'POST',
        body: JSON.stringify({ presence }),
      });
      expect(status, `presence '${presence}' should be rejected`).toBe(400);
    }

    // A missing field and an unknown one are both rejected — the schema is
    // `.strict()`, so this doubles as a mass-assignment guard.
    const missing = await apiRequest('/auth/presence', accessToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(missing.status, 'missing presence should be rejected').toBe(400);

    const extra = await apiRequest('/auth/presence', accessToken, {
      method: 'POST',
      body: JSON.stringify({ presence: 'online', isAdmin: true }),
    });
    expect(extra.status, 'unknown keys should be rejected').toBe(400);
  });

  test('status text is length-bounded and its presence is validated', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.projectAdmin.email);

    const tooLong = await apiRequest('/auth/status', accessToken, {
      method: 'POST',
      body: JSON.stringify({ statusText: 'x'.repeat(101) }),
    });
    expect(tooLong.status, 'over 100 characters should be rejected').toBe(400);

    const badPresence = await apiRequest('/auth/status', accessToken, {
      method: 'POST',
      body: JSON.stringify({ statusText: 'Focusing', presence: 'busy' }),
    });
    expect(badPresence.status, "presence 'busy' should be rejected").toBe(400);

    // Clearing the status is what the client sends on "Clear status".
    const cleared = await apiRequest('/auth/status', accessToken, {
      method: 'POST',
      body: JSON.stringify({ statusText: '' }),
    });
    expect(cleared.status).toBe(200);
    expect(cleared.data.user.statusText).toBe('');
  });

  test('PATCH /auth/preferences merges preferences instead of replacing them', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.viewer.email);

    const first = await apiRequest('/auth/preferences', accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ preferences: { theme: 'dark' } }),
    });
    expect(first.status).toBe(200);
    expect(first.data.preferences.theme).toBe('dark');

    const second = await apiRequest('/auth/preferences', accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ preferences: { language: 'en' } }),
    });
    expect(second.status).toBe(200);
    expect(second.data.preferences.theme).toBe('dark');
    expect(second.data.preferences.language).toBe('en');
  });

  test('status, presence and preferences require authentication (401)', async () => {
    const checks = [
      ['POST', '/auth/status', { statusText: 'x' }],
      ['POST', '/auth/presence', { presence: 'online' }],
      ['PATCH', '/auth/preferences', { preferences: { theme: 'dark' } }],
    ] as const;

    for (const [method, path, body] of checks) {
      const { status } = await apiRequest(path, '', { method, body: JSON.stringify(body) });
      expect(status, `${method} ${path} should be 401`).toBe(401);
    }
  });
});