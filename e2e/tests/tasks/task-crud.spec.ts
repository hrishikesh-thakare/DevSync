/**
 * Task CRUD & Comments Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, ROUTES } from '../../helpers/constants.js';
import { apiLogin, apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

// Retries once on 500/404: on Windows the dev backend intermittently fails a
// single request (or returns a corrupted empty query result → 404) while
// fire-and-forget Gemini calls are in flight (undici/libuv uv_async assertion).
async function resilient(method: 'PATCH' | 'DELETE', url: string, token: string, body?: any) {
  const opts: RequestInit = { method };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const first = await apiRequest(url, token, opts);
  if (first.status !== 500 && first.status !== 404) return first;
  await new Promise((r) => setTimeout(r, 750));
  return apiRequest(url, token, opts);
}

test.describe('Task CRUD', () => {
  test('can create task via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          title: `API Task ${Date.now()}`,
          issueType: 'task',
          priority: 'medium',
        }),
      }
    );
    expect([200, 201]).toContain(status);
    expect(data?.task?.taskKey || data?.taskKey).toBeTruthy();
  });

  test('can list tasks via API', async () => {
    const accessToken = getAuthToken('owner');
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('can get single task via API', async () => {
    const accessToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('can update task fields via API', async () => {
    const accessToken = getAuthToken('owner');

    // Create a task to update
    const { data: newTask } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: `Update Me ${Date.now()}`, issueType: 'task' }),
      }
    );

    const taskKey = newTask?.task?.taskKey || newTask?.taskKey;
    if (!taskKey) {
      test.skip();
      return;
    }

    const { status } = await resilient(
      'PATCH',
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`,
      accessToken,
      {
        title: 'Updated Title',
        priority: 'high',
        status: 'in_progress',
      }
    );
    expect(status).toBe(200);
  });

  test('can delete task via API (project admin)', async () => {
    const accessToken = getAuthToken('owner');

    const { data: newTask } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: `Delete Me ${Date.now()}`, issueType: 'task' }),
      }
    );

    const taskKey = newTask?.task?.taskKey || newTask?.taskKey;
    if (!taskKey) {
      test.skip();
      return;
    }

    const { status } = await resilient(
      'DELETE',
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`,
      accessToken
    );
    expect([200, 204]).toContain(status);
  });

  test('board page renders tasks (UI)', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.projectBoard(SLUG, KEY));
    await ownerPage.waitForLoadState('networkidle');

    // Verify board columns are visible
    const statusHeaders = ownerPage.locator('text=/Todo|In Progress|In Review|Done/i');
    await expect(statusHeaders.first()).toBeVisible({ timeout: 10_000 });
  });

  test('can reorder a task via API', async () => {
    const accessToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, accessToken);
    const tasks = tasksData?.tasks || tasksData || [];
    if (tasks.length < 2) { test.skip(); return; }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${tasks[0].taskKey}/reorder`,
      accessToken,
      { method: 'PATCH', body: JSON.stringify({ afterTaskId: tasks[1].taskId }) }
    );
    expect(status).toBe(200);
  });

  // Tied ranks are the common case in a fresh project (every task created but
  // never reordered shares a default rank), and generateKeyBetween throws on
  // a non-increasing pair — so the endpoint has to resolve that itself rather
  // than 500. This drops a card between two neighbours that may well be tied.
  test('reordering between two tied-rank neighbours does not error', async () => {
    const accessToken = getAuthToken('owner');
    const { data: tasksData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, accessToken);
    const tasks = tasksData?.tasks || tasksData || [];
    if (tasks.length < 3) { test.skip(); return; }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${tasks[0].taskKey}/reorder`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({ afterTaskId: tasks[1].taskId, beforeTaskId: tasks[2].taskId }),
      }
    );
    expect(status).toBe(200);
  });
});

test.describe('Task Comments', () => {
  test('can post comment on task via API', async () => {
    const accessToken = getAuthToken('owner');

    // Get a task
    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}/comments`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ bodyText: `E2E test comment ${Date.now()}` }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('can list comments on task via API', async () => {
    const accessToken = getAuthToken('owner');

    const { data: tasksData } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    const task = tasksData?.tasks?.[0] || tasksData?.[0];
    if (!task) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${task.taskKey}/comments`,
      accessToken
    );
    expect(status).toBe(200);
  });
});
