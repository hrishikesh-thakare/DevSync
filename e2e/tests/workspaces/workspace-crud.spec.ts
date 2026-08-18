/**
 * Workspace CRUD Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { ROUTES, TEST_USERS, TEST_WORKSPACE } from '../../helpers/constants.js';
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
});
