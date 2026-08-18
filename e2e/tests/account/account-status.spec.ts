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
      body: JSON.stringify({ statusText: 'In a meeting', presence: 'busy' }),
    });
    expect(status).toBe(200);
    expect(data.user.presence).toBe('busy');
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