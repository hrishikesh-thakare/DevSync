/**
 * Project CRUD Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, ROUTES } from '../../helpers/constants.js';
import { apiLogin, apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Project CRUD', () => {
  test('can view project list', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.projects(SLUG));
    await ownerPage.waitForLoadState('networkidle');

    // Should see the test project
    await expect(
      ownerPage.locator(`text=${TEST_PROJECT.name}`).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('can create project via API', async () => {
    const accessToken = getAuthToken('owner');
    const uniqueKey = `T${Date.now().toString().slice(-4)}`;
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          name: `CRUD Test Project ${uniqueKey}`,
          key: uniqueKey,
        }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('can get project details via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('can update project description via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({ description: 'Updated by E2E test' }),
      }
    );
    expect(status).toBe(200);
  });

  test('can view project board (UI)', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.projectBoard(SLUG, KEY));
    await ownerPage.waitForLoadState('networkidle');

    // Board should display Kanban columns
    const columns = ownerPage.locator('[data-testid*="column"], [class*="column"], [class*="kanban"]');
    // Or look for status text
    const statusText = ownerPage.locator('text=/Todo|In Progress|In Review|Done/i');
    await expect(statusText.first()).toBeVisible({ timeout: 10_000 });
  });
});
