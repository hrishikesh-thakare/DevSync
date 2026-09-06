/**
 * Workspace Members Management Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS, ROUTES, TEST_PASSWORD } from '../../helpers/constants.js';
import { apiLogin, apiRequest, verifyEmail } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

test.describe('Workspace Members', () => {
  test('owner can view members list', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.workspaceMembers(SLUG));
    await ownerPage.waitForLoadState('networkidle');

    // Should see members listed
    await expect(ownerPage.locator('text=Alice Carter').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can list workspace members via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/members`, accessToken);
    expect(status).toBe(200);
  });

  test('members list honors an opt-in limit/offset', async () => {
    // Regression guard: listWorkspaceMembers used to have no ceiling at all.
    // Default behavior (no params) is untouched; this only proves the new
    // opt-in paging actually takes effect when asked for.
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const page1 = await apiRequest(`/workspaces/${SLUG}/members?limit=5`, accessToken);
    expect(page1.status).toBe(200);
    expect(page1.data.members).toHaveLength(5);

    const page2 = await apiRequest(`/workspaces/${SLUG}/members?limit=5&offset=5`, accessToken);
    expect(page2.status).toBe(200);
    expect(page2.data.members).toHaveLength(5);

    const page1Ids = page1.data.members.map((m: any) => m.userId);
    const page2Ids = page2.data.members.map((m: any) => m.userId);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  test('owner can invite a user via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const testEmail = `invite-test-${Date.now()}@demo.com`;

    // First register the user
    const regRes = await fetch(`${process.env.API_URL || 'http://localhost:3001/api'}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, fullName: 'Invite Test', password: TEST_PASSWORD }),
    });

    expect(regRes.ok).toBe(true);
    const regData = await regRes.json();
    await verifyEmail(regData);
    const { status } = await apiRequest(`/workspaces/${SLUG}/invite`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, role: 'member' }),
    });
    expect([200, 201]).toContain(status);
  });

  test('admin cannot invite someone as owner (privilege escalation)', async () => {
    // Regression guard: inviteMemberSchema used to accept the full role enum
    // (including 'owner') on a route gated to owner OR admin, so any admin
    // could mint a co-owner by inviting them directly with role: 'owner'.
    // Granting ownership now has exactly one path — updateMemberRole, which
    // is locked to the real owner alone.
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);
    const testEmail = `escalation-test-${Date.now()}@demo.com`;

    const { status, data } = await apiRequest(`/workspaces/${SLUG}/invite`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, role: 'owner' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  test('admin can remove a member via API', async () => {
    const email = `remove-test-${Date.now()}@demo.com`;
    const regRes = await fetch(`${process.env.API_URL || 'http://localhost:3001/api'}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: 'Remove Test', password: TEST_PASSWORD }),
    });
    expect(regRes.ok).toBe(true);
    const regData = await regRes.json();
    const { user } = regData;
    await verifyEmail(regData);

    const ownerLogin = await apiLogin(TEST_USERS.owner.email);
    await apiRequest(`/workspaces/${SLUG}/invite`, ownerLogin.accessToken, {
      method: 'POST', body: JSON.stringify({ email, role: 'member' }),
    });
    const tempLoginRes = await fetch(`${process.env.API_URL || 'http://localhost:3001/api'}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const { accessToken: tempToken } = await tempLoginRes.json();
    await apiRequest(`/workspaces/${SLUG}/invites/accept`, tempToken, { method: 'POST' });

    const { accessToken: adminToken } = await apiLogin(TEST_USERS.admin.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/members/${user.userId}`, adminToken, { method: 'DELETE' });
    expect([200, 204]).toContain(status);

    const { data: members } = await apiRequest(`/workspaces/${SLUG}/members`, ownerLogin.accessToken);
    const stillActive = (members?.members || members || []).some(
      (m: any) => (m.userId || m.user?.userId) === user.userId && m.state === 'active'
    );
    expect(stillActive).toBe(false);
  });
});
