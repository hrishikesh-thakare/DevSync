/**
 * Session Management — API level tests
 * @tags @auth
 */
import { test, expect } from '@playwright/test';
import { API_URL, TEST_USERS, TEST_PASSWORD } from '../../helpers/constants.js';
import { apiRequest } from '../../helpers/api-helpers.js';

const OWNER = TEST_USERS.owner;
const testEmail = `sessions-${Date.now()}@demo.com`;

async function realLogin(email: string, password: string = TEST_PASSWORD) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  const setCookie = res.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  const cookie = setCookie!.split(';')[0];
  return { accessToken: body.accessToken as string, cookie, user: body.user };
}

// Newest session = latest login. Sessions belong to a dedicated test user so
// parallel tests can never create interfering sessions for it.
async function newestSession(token: string, cookie?: string) {
  const { data } = await listSessions(token, cookie);
  return data.sessions.reduce((a: any, b: any) => (new Date(a.issuedAt) > new Date(b.issuedAt) ? a : b));
}

async function listSessions(token: string, cookie?: string) {
  return apiRequest('/auth/sessions', token, cookie ? { headers: { Cookie: cookie } } : undefined);
}

test.describe('Session Management — API @auth', () => {
  // One shared test user + a sequence of logins/revocations — must never
  // interleave across workers (fullyParallel is global).
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    const reg = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, fullName: 'Sessions Tester', password: TEST_PASSWORD }),
    });
    expect([200, 201]).toContain(reg.status);
  });

  test('GET /auth/sessions returns session records with expected fields', async () => {
    const { accessToken } = await realLogin(testEmail);
    const { status, data } = await listSessions(accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions.length).toBeGreaterThan(0);
    for (const s of data.sessions) {
      expect(s.tokenId).toBeTruthy();
      expect(s.issuedAt).toBeTruthy();
      expect(s.expiresAt).toBeTruthy();
      expect(typeof s.isCurrent).toBe('boolean');
    }
  });

  test('sessions require authentication (401)', async () => {
    const { status } = await apiRequest('/auth/sessions', '');
    expect(status).toBe(401);
  });

  test('revoking a non-existent session returns 404', async () => {
    const { accessToken } = await realLogin(testEmail);
    const { status, data } = await apiRequest(
      `/auth/sessions/${'00000000-0000-4000-8000-000000000000'}/revoke`,
      accessToken,
      { method: 'POST' }
    );
    expect(status).toBe(404);
    expect(data.error).toBe('Session not found.');
  });

  test('cannot revoke another user\'s session (404)', async () => {
    const owner = await realLogin(OWNER.email);
    const dev = await realLogin(TEST_USERS.developer.email);
    const devSessions = await listSessions(dev.accessToken);
    const devTokenId = devSessions.data.sessions[0]?.tokenId;
    test.skip(!devTokenId, 'Developer has no sessions');

    const { status } = await apiRequest(`/auth/sessions/${devTokenId}/revoke`, owner.accessToken, { method: 'POST' });
    expect(status).toBe(404);
  });

  test('revoking a session invalidates its refresh token', async () => {
    const loginA = await realLogin(testEmail);
    const loginB = await realLogin(testEmail);
    const sessionB = await newestSession(loginA.accessToken, loginA.cookie);

    const { status } = await apiRequest(`/auth/sessions/${sessionB.tokenId}/revoke`, loginA.accessToken, { method: 'POST' });
    expect(status).toBe(200);

    const after = await listSessions(loginA.accessToken, loginA.cookie);
    expect(after.data.sessions.some((s: any) => s.tokenId === sessionB.tokenId)).toBe(false);

    const refresh = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { Cookie: loginB.cookie } });
    expect(refresh.status).toBe(401);
  });

  test('revoke-others keeps the current session and revokes the rest', async () => {
    const loginA = await realLogin(testEmail);
    const loginB = await realLogin(testEmail);
    const { data } = await listSessions(loginA.accessToken, loginA.cookie);
    const current = data.sessions.find((s: any) => s.isCurrent === true);
    const other = await newestSession(loginA.accessToken, loginA.cookie);
    test.skip(!current, 'Could not identify the current session');

    const { status } = await apiRequest('/auth/sessions/revoke-others', loginA.accessToken, {
      method: 'POST',
      headers: { Cookie: loginA.cookie },
    });
    expect(status).toBe(200);

    // Current session must still be alive
    const after = await listSessions(loginA.accessToken, loginA.cookie);
    expect(after.data.sessions.some((s: any) => s.tokenId === current.tokenId)).toBe(true);
    expect(after.data.sessions.some((s: any) => s.tokenId === other.tokenId)).toBe(false);

    // Other session's refresh token must be dead, current one must still work
    const otherRefresh = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { Cookie: loginB.cookie } });
    expect(otherRefresh.status).toBe(401);
    const currentRefresh = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { Cookie: loginA.cookie } });
    expect(currentRefresh.status).toBe(200);
  });
});