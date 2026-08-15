/**
 * RBAC — Project-Level Role Enforcement Tests
 * @tags @rbac
 *
 * Tests that project roles (project_admin / developer / viewer) correctly gate
 * access to project features. These tests cover task creation, sprint management,
 * project members, and read-only enforcement for viewers.
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, ROUTES } from '../../helpers/constants.js';
import { apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Project RBAC — Task Creation @rbac', () => {
  test('project_admin CAN create tasks (UI)', async ({ projectAdminPage }) => {
    await projectAdminPage.goto(ROUTES.projectBoard(SLUG, KEY));
    await projectAdminPage.waitForLoadState('networkidle');

    const createBtn = projectAdminPage.locator(
      'button:has-text("Create"), button:has-text("New Task"), button:has-text("Add Task"), [data-testid="create-task"]'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test('developer CAN create tasks (API)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: `RBAC Test Task ${Date.now()}`, issueType: 'task' }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('viewer CANNOT create tasks (API 403)', async () => {
    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: 'Unauthorized Task', issueType: 'task' }),
      }
    );
    expect(status).toBe(403);
  });

  test('viewer CANNOT see create task button (UI)', async ({ viewerPage }) => {
    await viewerPage.goto(ROUTES.projectBoard(SLUG, KEY));
    await viewerPage.waitForLoadState('networkidle');

    const createBtn = viewerPage.locator(
      'button:has-text("Create Task"), button:has-text("New Task"), button:has-text("Add Task"), [data-testid="create-task"]'
    );
    await expect(createBtn).toHaveCount(0, { timeout: 5_000 });
  });
});

test.describe('Project RBAC — Task Modification @rbac', () => {
  test('developer CAN update tasks (API)', async () => {
    const ownerToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      ownerToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) { test.skip(); return; }

    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}`,
      accessToken,
      { method: 'PATCH', body: JSON.stringify({ priority: 'high' }) }
    );
    expect([200, 204]).toContain(status);
  });

  test('viewer CANNOT update tasks (API 403)', async () => {
    const ownerToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      ownerToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) { test.skip(); return; }

    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}`,
      accessToken,
      { method: 'PATCH', body: JSON.stringify({ priority: 'low' }) }
    );
    expect(status).toBe(403);
  });
});

test.describe('Project RBAC — Task Deletion @rbac', () => {
  test('project_admin CAN delete tasks (API)', async () => {
    const accessToken = getAuthToken('projectAdmin');
    const { status: createStatus, data: newTask } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: `Delete Me ${Date.now()}`, issueType: 'task' }),
      }
    );
    if (createStatus >= 400) { test.skip(); return; }

    const taskKey = newTask?.task?.taskKey || newTask?.taskKey;
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`,
      accessToken,
      { method: 'DELETE' }
    );
    expect([200, 204]).toContain(status);
  });

  test('developer CANNOT delete tasks (API 403)', async () => {
    const ownerToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      ownerToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) { test.skip(); return; }

    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}`,
      accessToken,
      { method: 'DELETE' }
    );
    expect(status).toBe(403);
  });
});

test.describe('Project RBAC — Sprint Management @rbac', () => {
  test('project_admin CAN create sprints (API)', async () => {
    const accessToken = getAuthToken('projectAdmin');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ name: `RBAC Sprint ${Date.now()}` }) }
    );
    expect([200, 201]).toContain(status);
  });

  test('developer CANNOT create sprints (API 403)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ name: 'Unauthorized Sprint' }) }
    );
    expect(status).toBe(403);
  });

  test('viewer CANNOT create sprints (API 403)', async () => {
    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ name: 'Viewer Sprint' }) }
    );
    expect(status).toBe(403);
  });

  test('viewer CAN list sprints (read-only API)', async () => {
    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken
    );
    expect(status).toBe(200);
  });
});

test.describe('Project RBAC — Project Member Management @rbac', () => {
  test('project_admin CAN list project members (API)', async () => {
    const accessToken = getAuthToken('projectAdmin');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('developer CANNOT add project members (API 403)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ userId: 'some-fake-uuid', role: 'developer' }) }
    );
    expect(status).toBe(403);
  });

  test('viewer CANNOT add project members (API 403)', async () => {
    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ userId: 'some-fake-uuid', role: 'viewer' }) }
    );
    expect(status).toBe(403);
  });
});

test.describe('Project RBAC — Project Settings & Archive @rbac', () => {
  test('project_admin CAN access project settings (UI)', async ({ projectAdminPage }) => {
    await projectAdminPage.goto(ROUTES.projectSettings(SLUG, KEY));
    await projectAdminPage.waitForLoadState('networkidle');
    await expect(projectAdminPage).toHaveURL(new RegExp(`/projects/${KEY}/settings`));
  });

  test('developer CANNOT archive project (API 403)', async () => {
    const accessToken = getAuthToken('developer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/archive`,
      accessToken,
      { method: 'PATCH', body: JSON.stringify({ archived: true }) }
    );
    expect(status).toBe(403);
  });

  test('viewer CANNOT update project (API 403)', async () => {
    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}`,
      accessToken,
      { method: 'PUT', body: JSON.stringify({ description: 'Hacked description' }) }
    );
    expect(status).toBe(403);
  });
});

test.describe('Project RBAC — Viewer Read-Only Enforcement @rbac', () => {
  test('viewer CAN list tasks (read-only)', async () => {
    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('viewer CAN view individual task', async () => {
    const ownerToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      ownerToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) { test.skip(); return; }

    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('viewer CANNOT comment on tasks (API 403)', async () => {
    const ownerToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      ownerToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) { test.skip(); return; }

    const accessToken = getAuthToken('viewer');
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}/comments`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ content: 'Unauthorized comment' }) }
    );
    expect(status).toBe(403);
  });
});
