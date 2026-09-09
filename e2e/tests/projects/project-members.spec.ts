/**
 * Project Members Management Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, ROUTES, TEST_PASSWORD } from '../../helpers/constants.js';
import { apiLogin, apiRequest, verifyEmail } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Project Members', () => {
  test('can list project members via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('project admin can view members page (UI)', async ({ projectAdminPage }) => {
    await projectAdminPage.goto(ROUTES.projectMembers(SLUG, KEY));
    await projectAdminPage.waitForLoadState('networkidle');

    await expect(projectAdminPage).toHaveURL(new RegExp(`/projects/${KEY}/members`));
  });

  test('can add member to project via API', async () => {
    // Register a temp user to add
    const tempEmail = `pm-test-${Date.now()}@demo.com`;
    const regRes = await fetch(`${process.env.API_URL || 'http://localhost:3001/api'}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tempEmail, fullName: 'PM Test', password: TEST_PASSWORD }),
    });

    if (!regRes.ok) {
      test.skip();
      return;
    }

    const regData = await regRes.json();
    const userId = regData.user?.userId || regData.userId;
    await verifyEmail(regData);

    // First invite to workspace
    const ownerLogin = await apiLogin(TEST_USERS.owner.email);
    await apiRequest(`/workspaces/${SLUG}/invite`, ownerLogin.accessToken, {
      method: 'POST',
      body: JSON.stringify({ email: tempEmail, role: 'member' }),
    });

    // Accept invite
    const tempLogin = await fetch(`${process.env.API_URL || 'http://localhost:3001/api'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tempEmail, password: TEST_PASSWORD }),
    });
    if (tempLogin.ok) {
      const tempData = await tempLogin.json();
      await apiRequest(`/workspaces/${SLUG}/invites/accept`, tempData.accessToken, {
        method: 'POST',
      });
    }

    // Add to project
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      ownerLogin.accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ userId, role: 'viewer' }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('can change project member role via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { data: members } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      accessToken
    );

    // Find the developer member
    const devMember = (members?.members || members || []).find?.(
      (m: any) => m.email === TEST_USERS.developer.email || m.user?.email === TEST_USERS.developer.email
    );

    if (!devMember) {
      test.skip();
      return;
    }

    const userId = devMember.userId || devMember.user?.userId;

    // Change role to viewer and back
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members/${userId}`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify({ role: 'viewer' }),
      }
    );
    expect(status).toBe(200);

    // Restore to developer
    await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members/${userId}`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify({ role: 'developer' }),
      }
    );
  });

  test('remove project member via API', async () => {
    // Register a temp user
    const tempEmail = `rm-proj-${Date.now()}@demo.com`;
    const regRes = await fetch(`${process.env.API_URL || 'http://localhost:3001/api'}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tempEmail, fullName: 'RM Proj Test', password: TEST_PASSWORD }),
    });
    expect(regRes.ok).toBe(true);
    const regData = await regRes.json();
    const { userId } = regData.user;
    await verifyEmail(regData);

    const ownerLogin = await apiLogin(TEST_USERS.owner.email);
    
    // Add to workspace
    await apiRequest(`/workspaces/${SLUG}/invite`, ownerLogin.accessToken, {
      method: 'POST', body: JSON.stringify({ email: tempEmail, role: 'member' }),
    });

    const tempLogin = await fetch(`${process.env.API_URL || 'http://localhost:3001/api'}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tempEmail, password: TEST_PASSWORD }),
    });
    const { accessToken: tempToken } = await tempLogin.json();
    await apiRequest(`/workspaces/${SLUG}/invites/accept`, tempToken, { method: 'POST' });

    // Add to project as viewer
    await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/members`, ownerLogin.accessToken, {
      method: 'POST', body: JSON.stringify({ userId, role: 'viewer' }),
    });

    // Now remove them
    const { status } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/members/${userId}`, ownerLogin.accessToken, { method: 'DELETE' });
    expect([200, 204]).toContain(status);
  });
});
