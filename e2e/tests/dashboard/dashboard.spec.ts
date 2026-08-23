import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

/** Sections the endpoint returns only to workspace owners and admins. */
const ADMIN_ONLY_KEYS = ['projects', 'atRisk', 'workload', 'pendingInvites', 'activity'] as const;

test.describe('Workspace dashboard', () => {
  let ownerToken: string;

  test.beforeAll(async () => {
    ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
  });

  test('returns the shared my-work and sprint sections', async () => {
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/dashboard`, ownerToken);
    expect(status).toBe(200);

    expect(data.role).toBe('owner');
    expect(data.myWork).toBeTruthy();
    expect(typeof data.myWork.overdue).toBe('number');
    expect(typeof data.myWork.dueSoon).toBe('number');
    expect(Array.isArray(data.myWork.tasks)).toBe(true);
    // The list is a preview; My Tasks is the full view.
    expect(data.myWork.tasks.length).toBeLessThanOrEqual(5);

    for (const key of ['todo', 'in_progress', 'in_review']) {
      expect(typeof data.myWork.counts[key], `counts.${key}`).toBe('number');
    }

    expect(Array.isArray(data.sprints)).toBe(true);
  });

  test('my-work never includes completed tasks', async () => {
    const { data } = await apiRequest(`/workspaces/${SLUG}/dashboard`, ownerToken);
    for (const task of data.myWork.tasks) {
      expect(task.status, `${task.taskKey} should not be done`).not.toBe('done');
    }
  });

  test('owners receive the admin sections', async () => {
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/dashboard`, ownerToken);
    expect(status).toBe(200);

    for (const key of ADMIN_ONLY_KEYS) {
      expect(data, `owner payload should carry ${key}`).toHaveProperty(key);
    }

    expect(Array.isArray(data.projects)).toBe(true);
    expect(Array.isArray(data.workload)).toBe(true);
    expect(Array.isArray(data.atRisk.overdue)).toBe(true);
    expect(Array.isArray(data.atRisk.stalled)).toBe(true);

    // Progress is a ratio of real counts, never a fabricated burndown series.
    for (const project of data.projects) {
      expect(project.doneTasks).toBeLessThanOrEqual(project.totalTasks);
      expect(project.percentComplete).toBeGreaterThanOrEqual(0);
      expect(project.percentComplete).toBeLessThanOrEqual(100);
    }
  });

  test('admins also receive the admin sections', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/dashboard`, accessToken);

    expect(status).toBe(200);
    expect(data.role).toBe('admin');
    for (const key of ADMIN_ONLY_KEYS) {
      expect(data, `admin payload should carry ${key}`).toHaveProperty(key);
    }
  });

  test('plain members get their own work but no admin sections', async () => {
    for (const email of [TEST_USERS.developer.email, TEST_USERS.viewer.email]) {
      const { accessToken } = await apiLogin(email);
      const { status, data } = await apiRequest(`/workspaces/${SLUG}/dashboard`, accessToken);

      expect(status, `${email} should reach the dashboard`).toBe(200);
      expect(data.role).toBe('member');
      expect(data.myWork).toBeTruthy();

      // Absent entirely, not merely empty — the shape must not disclose that
      // these sections exist.
      for (const key of ADMIN_ONLY_KEYS) {
        expect(data, `${email} must not receive ${key}`).not.toHaveProperty(key);
      }
    }
  });

  test('sprint progress never exceeds its totals', async () => {
    const { data } = await apiRequest(`/workspaces/${SLUG}/dashboard`, ownerToken);
    for (const sprint of data.sprints) {
      expect(sprint.doneTasks).toBeLessThanOrEqual(sprint.totalTasks);
      expect(sprint.donePoints).toBeLessThanOrEqual(sprint.totalPoints);
    }
  });

  test('non-members are denied', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/dashboard`, accessToken);
    expect(status).toBe(403);
  });

  test('requires authentication', async () => {
    const { status } = await apiRequest(`/workspaces/${SLUG}/dashboard`, '');
    expect(status).toBe(401);
  });
});

test.describe('My tasks filtering', () => {
  let ownerToken: string;

  test.beforeAll(async () => {
    ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
  });

  test('defaults to open tasks only', async () => {
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/my-tasks`, ownerToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.tasks)).toBe(true);
    for (const task of data.tasks) {
      expect(task.status, `${task.taskKey} should not be done`).not.toBe('done');
    }
  });

  test('status=all includes completed tasks', async () => {
    const open = await apiRequest(`/workspaces/${SLUG}/my-tasks`, ownerToken);
    const all = await apiRequest(`/workspaces/${SLUG}/my-tasks?status=all`, ownerToken);

    expect(all.status).toBe(200);
    expect(all.data.tasks.length).toBeGreaterThanOrEqual(open.data.tasks.length);
  });

  test('narrows to an explicit status list', async () => {
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/my-tasks?status=todo,in_progress`,
      ownerToken,
    );
    expect(status).toBe(200);
    for (const task of data.tasks) {
      expect(['todo', 'in_progress']).toContain(task.status);
    }
  });

  test('rejects an unknown status rather than ignoring it', async () => {
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/my-tasks?status=nonsense`,
      ownerToken,
    );
    expect(status).toBe(400);
    expect(data.error).toContain('Unknown status');
  });

  test('rows carry the fields the task card renders', async () => {
    const { data } = await apiRequest(`/workspaces/${SLUG}/my-tasks`, ownerToken);
    test.skip(data.tasks.length === 0, 'No tasks assigned to the owner');

    const task = data.tasks[0];
    // The board and My Tasks share TaskCardBody, which reads all of these.
    for (const key of ['taskKey', 'title', 'status', 'priority', 'issueType', 'projectKey', 'projectName']) {
      expect(task, `my-tasks row should carry ${key}`).toHaveProperty(key);
    }
    expect(task).toHaveProperty('assigneeName');
    expect(task).toHaveProperty('linkedCommitsCount');
  });
});
