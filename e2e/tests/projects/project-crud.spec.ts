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

  test('can create project via API and read it back', async () => {
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
    expect(status).toBe(201);
    expect(data.project.key).toBe(uniqueKey);
    expect(data.project.projectId).toBeTruthy();

    const fetched = await apiRequest(`/workspaces/${SLUG}/projects/${uniqueKey}`, accessToken);
    expect(fetched.status).toBe(200);
    expect(fetched.data.project.name).toBe(`CRUD Test Project ${uniqueKey}`);
  });

  test('duplicate project key is rejected with 409', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate Key', key: KEY }),
    });
    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  test('can get project details via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}`,
      accessToken
    );
    expect(status).toBe(200);
    expect(data.project.key).toBe(KEY);
  });

  test('can update project description via API', async () => {
    const accessToken = getAuthToken('owner');
    const newDescription = `Updated by E2E test ${Date.now()}`;
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({ description: newDescription }),
      }
    );
    expect(status).toBe(200);

    const fetched = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, accessToken);
    expect(fetched.data.project.description).toBe(newDescription);
  });
  test('archive project succeeds via API', async () => {
    const accessToken = getAuthToken('owner');
    
    // Create a disposable project to archive
    const uniqueKey = `A${Date.now().toString().slice(-4)}`;
    const { data: newProj, status: createStatus } = await apiRequest(`/workspaces/${SLUG}/projects`, accessToken, {
      method: 'POST', body: JSON.stringify({ name: 'To Archive', key: uniqueKey })
    });
    expect(createStatus).toBe(201);

    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${uniqueKey}/archive`, accessToken, { method: 'PATCH' });
    expect(status).toBe(200);
    expect(data.project.status).toBe('archived');

    const fetched = await apiRequest(`/workspaces/${SLUG}/projects/${uniqueKey}`, accessToken);
    expect(fetched.data.project.status).toBe('archived');
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
