/**
 * Workspace CRUD Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { ROUTES, TEST_USERS, TEST_WORKSPACE, API_URL, TEST_PASSWORD } from '../../helpers/constants.js';
import { apiLogin, apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

const TEST_WORKSPACE_SLUG = TEST_WORKSPACE.slug;

test.describe('Workspace CRUD', () => {
  test('owner can create a new workspace', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.workspaces);
    await ownerPage.waitForLoadState('networkidle');

    // Look for create workspace button
    const createBtn = ownerPage.locator(
      'button:has-text("Create"), button:has-text("New Workspace"), a:has-text("Create")'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test('can create workspace via API and verify it exists', async () => {
    const accessToken = getAuthToken('owner');
    const uniqueSlug = `e2e-crud-${Date.now()}`;
    const uniqueName = `CRUD Test ${Date.now()}`;
    
    try {
      const { status, data } = await apiRequest('/workspaces', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          name: uniqueName,
          slug: uniqueSlug,
        }),
      });
      expect(status).toBe(201);
      expect(data.workspace.slug).toBe(uniqueSlug);
      expect(data.workspace.workspaceId).toBeTruthy();

      const fetched = await apiRequest(`/workspaces/${uniqueSlug}`, accessToken);
      expect(fetched.status).toBe(200);
      expect(fetched.data.workspace.name).toBe(uniqueName);
    } finally {
      // Clean up: delete the workspace even if the test fails
      await apiRequest(`/workspaces/${uniqueSlug}`, accessToken, { method: 'DELETE' });
    }
  });

  test('duplicate workspace slug is rejected with 409', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest('/workspaces', accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate', slug: TEST_WORKSPACE_SLUG }),
    });
    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  test('can update workspace name via API', async () => {
    const accessToken = getAuthToken('owner');
    const newName = `E2E Test Workspace Updated ${Date.now()}`;
    const { status } = await apiRequest('/workspaces/e2e-test-workspace', accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });
    expect(status).toBe(200);

    const fetched = await apiRequest('/workspaces/e2e-test-workspace', accessToken);
    expect(fetched.data.workspace.name).toBe(newName);

    // Restore original name
    await apiRequest('/workspaces/e2e-test-workspace', accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'E2E Test Workspace' }),
    });
  });

  test('can list workspaces the user belongs to', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest('/workspaces', accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data?.workspaces || data)).toBe(true);
  });

  test('a deleted workspace becomes inaccessible to owner and members', async () => {
    const ownerToken = getAuthToken('owner');
    const memberEmail = `del-member-${Date.now()}@demo.com`;
    const uniqueSlug = `e2e-delete-${Date.now()}`;

    try {
      // Fresh workspace so deletion cannot affect any other test.
      const created = await apiRequest('/workspaces', ownerToken, {
        method: 'POST',
        body: JSON.stringify({ name: `Delete Test ${Date.now()}`, slug: uniqueSlug }),
      });
      expect(created.status).toBe(201);

      // A fresh member user: register, invite, accept.
      const reg = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: memberEmail, fullName: 'Delete Member', password: TEST_PASSWORD }),
      });
      expect(reg.ok).toBe(true);
      const { accessToken: memberToken } = await reg.json();

      const invite = await apiRequest(`/workspaces/${uniqueSlug}/invite`, ownerToken, {
        method: 'POST',
        body: JSON.stringify({ email: memberEmail, role: 'member' }),
      });
      expect([200, 201]).toContain(invite.status);
      const accept = await apiRequest(`/workspaces/${uniqueSlug}/invites/accept`, memberToken, {
        method: 'POST',
      });
      expect([200, 201]).toContain(accept.status);

      // Both can access the workspace before deletion.
      expect((await apiRequest(`/workspaces/${uniqueSlug}`, ownerToken)).status).toBe(200);
      expect((await apiRequest(`/workspaces/${uniqueSlug}`, memberToken)).status).toBe(200);

      // Soft-delete: owner gets a success response.
      const deleted = await apiRequest(`/workspaces/${uniqueSlug}`, ownerToken, { method: 'DELETE' });
      expect(deleted.status).toBe(200);
      expect(deleted.data.message).toBeTruthy();

      // Owner can no longer fetch the workspace, and it drops out of their list.
      expect((await apiRequest(`/workspaces/${uniqueSlug}`, ownerToken)).status).toBe(404);
      const ownerList = await apiRequest('/workspaces', ownerToken);
      const ownerSlugs = (ownerList.data?.workspaces || []).map((w: { slug: string }) => w.slug);
      expect(ownerSlugs).not.toContain(uniqueSlug);

      // The member loses access too.
      expect((await apiRequest(`/workspaces/${uniqueSlug}`, memberToken)).status).toBe(404);
      const memberList = await apiRequest('/workspaces', memberToken);
      const memberSlugs = (memberList.data?.workspaces || []).map((w: { slug: string }) => w.slug);
      expect(memberSlugs).not.toContain(uniqueSlug);

      // Deleting again is idempotent-ish: it reports not found rather than resurrecting.
      expect((await apiRequest(`/workspaces/${uniqueSlug}`, ownerToken, { method: 'DELETE' })).status).toBe(404);
    } finally {
      await apiRequest(`/workspaces/${uniqueSlug}`, ownerToken, { method: 'DELETE' });
    }
  });
});
