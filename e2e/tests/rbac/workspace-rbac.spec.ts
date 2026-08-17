/**
 * RBAC — Workspace-Level Role Enforcement Tests
 * @tags @rbac
 *
 * Tests that workspace roles (owner / admin / member) correctly gate
 * access to workspace features via both UI visibility and API responses.
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS, ROUTES } from '../../helpers/constants.js';
import { apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

test.describe('Workspace RBAC — Settings Access @rbac', () => {
  test('owner CAN access workspace settings page', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.workspaceSettings(SLUG));
    await ownerPage.waitForLoadState('networkidle');

    const pageContent = await ownerPage.textContent('body');
    expect(pageContent).toBeTruthy();
    await expect(ownerPage).toHaveURL(new RegExp(`/w/${SLUG}/settings`));
  });

  test('admin CAN access workspace settings page', async ({ adminPage }) => {
    await adminPage.goto(ROUTES.workspaceSettings(SLUG));
    await adminPage.waitForLoadState('networkidle');

    await expect(adminPage).toHaveURL(new RegExp(`/w/${SLUG}/settings`));

    // But admin cannot delete workspace via API
    const accessToken = getAuthToken('admin');
    const { status } = await apiRequest(`/workspaces/${SLUG}`, accessToken, {
      method: 'DELETE',
    });
    expect(status).toBe(403);
  });

  test('member CANNOT access workspace settings', async ({ viewerPage }) => {
    await viewerPage.goto(ROUTES.workspaceSettings(SLUG));
    await viewerPage.waitForLoadState('networkidle');

    // Member should be blocked from settings
    const url = viewerPage.url();
    const forbiddenText = await viewerPage.locator('text=/forbidden|not authorized|access denied/i').count();
    const isBlocked = !url.includes('/settings') || forbiddenText > 0;
    expect(isBlocked).toBe(true);

    // Verify API-level enforcement
    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(`/workspaces/${SLUG}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    expect(status).toBe(403);
  });
});

test.describe('Workspace RBAC — Member Invitations @rbac', () => {
  test('owner CAN see invite button on members page', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.workspaceMembers(SLUG));
    await ownerPage.waitForLoadState('networkidle');

    const inviteButton = ownerPage.locator('button:has-text("Invite"), button:has-text("invite"), [data-testid="invite-button"]');
    await expect(inviteButton.first()).toBeVisible({ timeout: 10_000 });
  });

  test('admin CAN see invite button on members page', async ({ adminPage }) => {
    await adminPage.goto(ROUTES.workspaceMembers(SLUG));
    await adminPage.waitForLoadState('networkidle');

    const inviteButton = adminPage.locator('button:has-text("Invite"), button:has-text("invite"), [data-testid="invite-button"]');
    await expect(inviteButton.first()).toBeVisible({ timeout: 10_000 });
  });

  test('member CANNOT see invite button on members page', async ({ developerPage }) => {
    await developerPage.goto(ROUTES.workspaceMembers(SLUG));
    await developerPage.waitForLoadState('networkidle');

    const inviteButton = developerPage.locator('button:has-text("Invite"), button:has-text("invite"), [data-testid="invite-button"]');
    await expect(inviteButton).toHaveCount(0, { timeout: 5_000 });
  });

  test('member CANNOT invite via API (403)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(`/workspaces/${SLUG}/invite`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ email: 'newinvite@test.com', role: 'member' }),
    });
    expect(status).toBe(403);
  });
});

test.describe('Workspace RBAC — Role Management @rbac', () => {
  test('owner CAN change member roles (API)', async () => {
    const ownerToken = getAuthToken('owner');
    const { data: members } = await apiRequest(`/workspaces/${SLUG}/members`, ownerToken);
    const devMember = (members?.members || members || []).find(
      (m: any) => (m.email || m.user?.email) === TEST_USERS.developer.email
    );
    if (!devMember) { test.skip(); return; }
    const userId = devMember.userId || devMember.user?.userId;

    try {
      const { status } = await apiRequest(`/workspaces/${SLUG}/members/${userId}`, ownerToken, {
        method: 'PATCH',
        body: JSON.stringify({ role: 'admin' }),
      });
      expect(status).toBe(200);

      const { data: after } = await apiRequest(`/workspaces/${SLUG}/members`, ownerToken);
      const updated = (after?.members || after || []).find((m: any) => (m.userId || m.user?.userId) === userId);
      expect(updated?.role).toBe('admin');
    } finally {
      // restore
      await apiRequest(`/workspaces/${SLUG}/members/${userId}`, ownerToken, {
        method: 'PATCH', body: JSON.stringify({ role: 'member' }),
      });
    }
  });

  test('admin CANNOT change member roles (API 403)', async () => {
    const ownerToken = getAuthToken('owner');
    const { data: members } = await apiRequest(`/workspaces/${SLUG}/members`, ownerToken);

    const memberUser = members?.members?.find?.((m: any) => m.role === 'member');
    if (!memberUser) { test.skip(); return; }

    const adminToken = getAuthToken('admin');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/members/${memberUser.userId}`,
      adminToken,
      { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) }
    );
    expect(status).toBe(403);
  });
});

test.describe('Workspace RBAC — Workspace Deletion @rbac', () => {
  test('admin CANNOT delete workspace (API 403)', async () => {
    const accessToken = getAuthToken('admin');
    const { status } = await apiRequest(`/workspaces/${SLUG}`, accessToken, {
      method: 'DELETE',
    });
    expect(status).toBe(403);
  });

  test('member CANNOT delete workspace (API 403)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(`/workspaces/${SLUG}`, accessToken, {
      method: 'DELETE',
    });
    expect(status).toBe(403);
  });
});

test.describe('Workspace RBAC — Project & Channel Creation Buttons @rbac', () => {
  test('owner CAN see "New Project" button', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.projects(SLUG));
    await ownerPage.waitForLoadState('networkidle');

    const newProjBtn = ownerPage.locator('button:has-text("New Project"), a:has-text("New Project"), button:has-text("Create Project"), a:has-text("Create Project")');
    await expect(newProjBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test('member CANNOT see "New Project" button', async ({ developerPage }) => {
    await developerPage.goto(ROUTES.projects(SLUG));
    await developerPage.waitForLoadState('networkidle');

    const newProjBtn = developerPage.locator('button:has-text("New Project"), a:has-text("New Project"), button:has-text("Create Project"), a:has-text("Create Project")');
    await expect(newProjBtn).toHaveCount(0, { timeout: 5_000 });
  });

  test('member CANNOT create project via API (403)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(`/workspaces/${SLUG}/projects`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Unauthorized Project', key: 'HACK' }),
    });
    expect(status).toBe(403);
  });

  test('member CANNOT create channel via API (403)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'hacked-channel', type: 'public' }),
    });
    expect(status).toBe(403);
  });
});

test.describe('Workspace RBAC — Non-Member Denial @rbac', () => {
  test('outsider CANNOT access workspace (API 403)', async () => {
    const accessToken = getAuthToken('outsider');
    const { status } = await apiRequest(`/workspaces/${SLUG}`, accessToken);
    expect(status).toBe(403);
  });

  test('outsider CANNOT list workspace members (API 403)', async () => {
    const accessToken = getAuthToken('outsider');
    const { status } = await apiRequest(`/workspaces/${SLUG}/members`, accessToken);
    expect(status).toBe(403);
  });
});
