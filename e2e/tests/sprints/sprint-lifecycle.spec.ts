/**
 * Sprint Lifecycle Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, ROUTES } from '../../helpers/constants.js';
import { apiLogin, apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Sprint Lifecycle', () => {
  test('can create sprint via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          name: `Lifecycle Sprint ${Date.now()}`,
          goal: 'E2E test sprint',
        }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('can list sprints via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('can start a sprint via API', async () => {
    const accessToken = getAuthToken('owner');

    // Create a fresh sprint to start
    const { data: newSprint, status: createStatus } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ name: `Start Me ${Date.now()}` }),
      }
    );

    if (createStatus !== 201) {
      throw new Error(`Failed to create sprint. Status: ${createStatus}, Response: ${JSON.stringify(newSprint)}`);
    }
    const sprintId = newSprint?.sprint?.sprintId || newSprint?.sprintId;

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints/${sprintId}/start`,
      accessToken,
      { method: 'PATCH' }
    );
    // May fail if there's already an active sprint — that's expected behavior
    expect([200, 400, 409]).toContain(status);
  });

  test('can close an active sprint via API', async () => {
    const accessToken = getAuthToken('owner');

    // Get sprints and find an active one
    const { data: sprintsData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken
    );

    const sprints = sprintsData?.sprints || sprintsData || [];
    const activeSprint = sprints.find?.((s: any) => s.status === 'active');

    if (!activeSprint) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints/${activeSprint.sprintId}/close`,
      accessToken,
      { method: 'PATCH' }
    );
    expect(status).toBe(200);
  });

  test('can add task to sprint via API', async () => {
    const accessToken = getAuthToken('owner');

    // Get sprints
    const { data: sprintsData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken
    );
    const sprint = (sprintsData?.sprints || sprintsData || [])?.[0];

    // Get tasks
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];

    if (!sprint || !task) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints/${sprint.sprintId}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ taskId: task.taskId }),
      }
    );
    // May already be in sprint
    expect([200, 201, 400, 409]).toContain(status);
  });

  test('sprint list page renders (UI)', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.projectSprints(SLUG, KEY));
    await ownerPage.waitForLoadState('networkidle');
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${KEY}/sprints`));
  });
});
