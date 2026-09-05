import { test, expect } from '../../fixtures/test-fixtures.js';
import { ROUTES, TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

/**
 * Multi-select + bulk assign/label/move — Part 4 item 5 of the audit plan:
 * "multi-select on board and backlog, then move/assign/label in one go."
 * There is no bulk endpoint on the backend; the client loops the existing
 * single-task PATCH (`useBulkUpdateTasksMutation` in `queries/tasks.ts`), the
 * same shape `BacklogPage.assignToSprint` already used for sprint assignment.
 * These tests drive the UI end to end and then verify the persisted result
 * over the API, rather than trusting a toast.
 *
 * Each test creates its own throwaway project rather than using the shared
 * `E2E` fixture project. Both Board (`COLUMN_RENDER_CAP = 100` per status)
 * and Backlog (`visible.slice(0, 200)`) cap how many cards they render, and
 * the shared project accumulates tasks from the whole suite with nothing
 * ever cleaning them up — a fresh task can silently render off-screen once
 * enough other specs have piled up ahead of it. A private, empty project
 * makes that impossible instead of just unlikely.
 *
 * Each throwaway project is deleted again at the end (`DELETE
 * /workspaces/:slug/projects/:key` — a real soft-delete, see
 * `project-crud.spec.ts`'s "delete project" tests), which takes its tasks
 * and label down with it: they aren't separately deleted first, because a
 * soft-deleted project already makes everything scoped to it unreachable
 * through the API, the same way a soft-deleted workspace does for its
 * projects.
 */

const SLUG = TEST_WORKSPACE.slug;

// `key` has a 10-character ceiling (`createProjectSchema`), so the prefix has
// to stay short enough to leave room for a disambiguating timestamp suffix.
async function createProject(token: string, keyPrefix: string) {
  const key = `${keyPrefix}${Date.now().toString().slice(-6)}`;
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects`, token, {
    method: 'POST',
    body: JSON.stringify({ name: `Bulk ops ${key}`, key }),
  });
  expect(status).toBe(201);
  return data.project.key as string;
}

async function createTask(token: string, key: string, title: string) {
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks`, token, {
    method: 'POST',
    body: JSON.stringify({ title, status: 'todo', issueType: 'task', priority: 'medium' }),
  });
  expect(status).toBe(201);
  return data.task;
}

async function deleteProject(token: string, key: string) {
  await apiRequest(`/workspaces/${SLUG}/projects/${key}`, token, { method: 'DELETE' });
}

test.describe('Bulk operations', () => {
  test('Board: select mode bulk-assigns and bulk-moves several cards at once', async ({ ownerPage }) => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const dev = await apiLogin(TEST_USERS.developer.email);
    const devUserId = dev.user.userId;

    const key = await createProject(owner.accessToken, 'BD');
    // A brand-new project starts with no project_members rows of its own —
    // Dave is a workspace member already, but the assignee dropdown only
    // lists actual project members, so he has to be added here explicitly.
    await apiRequest(`/workspaces/${SLUG}/projects/${key}/members`, owner.accessToken, {
      method: 'POST',
      body: JSON.stringify({ userId: devUserId, role: 'developer' }),
    });
    const taskA = await createTask(owner.accessToken, key, 'Bulk board A');
    const taskB = await createTask(owner.accessToken, key, 'Bulk board B');

    try {
      await ownerPage.goto(ROUTES.projectBoard(SLUG, key));
      await expect(ownerPage.getByText(taskA.title)).toBeVisible({ timeout: 10_000 });
      await expect(ownerPage.getByText(taskB.title)).toBeVisible();

      await ownerPage.getByRole('button', { name: 'Select' }).click();
      await ownerPage.getByRole('checkbox', { name: `Select ${taskA.taskKey}` }).click();
      await ownerPage.getByRole('checkbox', { name: `Select ${taskB.taskKey}` }).click();

      await ownerPage.getByRole('combobox', { name: 'Bulk assign' }).click();
      await ownerPage.getByRole('option', { name: TEST_USERS.developer.name }).click();

      await expect(ownerPage.getByText('Assigned 2 tasks')).toBeVisible({ timeout: 10_000 });

      const { data: afterAssign } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks`, owner.accessToken);
      const assignedA = afterAssign.tasks.find((t: any) => t.taskId === taskA.taskId);
      const assignedB = afterAssign.tasks.find((t: any) => t.taskId === taskB.taskId);
      expect(assignedA.assigneeId).toBe(devUserId);
      expect(assignedB.assigneeId).toBe(devUserId);

      // Selecting again and bulk-moving to Done — re-select since the
      // previous action clears selection on success.
      await ownerPage.getByRole('checkbox', { name: `Select ${taskA.taskKey}` }).click();
      await ownerPage.getByRole('checkbox', { name: `Select ${taskB.taskKey}` }).click();
      await ownerPage.getByRole('combobox', { name: 'Bulk move status' }).click();
      await ownerPage.getByRole('option', { name: 'Done' }).click();

      await expect(ownerPage.getByText('Moved 2 tasks')).toBeVisible({ timeout: 10_000 });

      const { data: afterMove } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks`, owner.accessToken);
      const movedA = afterMove.tasks.find((t: any) => t.taskId === taskA.taskId);
      const movedB = afterMove.tasks.find((t: any) => t.taskId === taskB.taskId);
      expect(movedA.status).toBe('done');
      expect(movedB.status).toBe('done');
    } finally {
      await deleteProject(owner.accessToken, key);
    }
  });

  test('Backlog: selecting several rows bulk-adds a label to all of them', async ({ ownerPage }) => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken, 'BL');

    const labelName = `bulk-e2e-${Date.now()}`;
    const { status: labelStatus } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/labels`, owner.accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: labelName }),
    });
    expect(labelStatus).toBe(201);

    const taskA = await createTask(owner.accessToken, key, 'Bulk backlog A');
    const taskB = await createTask(owner.accessToken, key, 'Bulk backlog B');

    try {
      await ownerPage.goto(ROUTES.projectBacklog(SLUG, key));
      await expect(ownerPage.getByText(taskA.title)).toBeVisible({ timeout: 10_000 });
      await expect(ownerPage.getByText(taskB.title)).toBeVisible();

      await ownerPage.getByRole('checkbox', { name: `Select ${taskA.taskKey}` }).click();
      await ownerPage.getByRole('checkbox', { name: `Select ${taskB.taskKey}` }).click();

      await ownerPage.getByRole('combobox', { name: 'Bulk add label' }).click();
      await ownerPage.getByRole('option', { name: labelName }).click();

      await expect(ownerPage.getByText('Labelled 2 tasks')).toBeVisible({ timeout: 10_000 });

      const { data } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks`, owner.accessToken);
      const a = data.tasks.find((t: any) => t.taskId === taskA.taskId);
      const b = data.tasks.find((t: any) => t.taskId === taskB.taskId);
      expect(a.labels).toContain(labelName);
      expect(b.labels).toContain(labelName);
    } finally {
      await deleteProject(owner.accessToken, key);
    }
  });
});
