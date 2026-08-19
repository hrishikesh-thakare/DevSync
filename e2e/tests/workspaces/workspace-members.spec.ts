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
