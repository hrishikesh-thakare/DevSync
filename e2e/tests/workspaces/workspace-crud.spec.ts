/**
 * Workspace CRUD Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { ROUTES, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

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

  test('can create workspace via API', async () => {
    const accessToken = getAuthToken('owner');
    const uniqueSlug = `e2e-crud-${Date.now()}`;
    const { status, data } = await apiRequest('/workspaces', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: `CRUD Test ${Date.now()}`,
        slug: uniqueSlug,
      }),
    });
    expect([200, 201]).toContain(status);

    // Clean up: delete the workspace
    await apiRequest(`/workspaces/${uniqueSlug}`, accessToken, { method: 'DELETE' });
  });

  test('can update workspace name via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status } = await apiRequest('/workspaces/e2e-test-workspace', accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'E2E Test Workspace Updated' }),
    });
    expect(status).toBe(200);

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
