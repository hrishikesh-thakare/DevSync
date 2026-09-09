import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;
const ts = Date.now();

test.describe('Audit Logs', () => {
  let ownerToken: string;

  test.beforeAll(async () => {
    ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
  });

  test('project update is logged with action and values', async () => {
    const { data: projData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, ownerToken);
    const projectId = projData?.project?.projectId || projData?.projectId;
    test.skip(!projectId, 'Project not found');

    const newDesc = `Audit test ${ts}`;
    const updated = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, ownerToken, {
      method: 'PATCH',
      body: JSON.stringify({ description: newDesc }),
    });
    expect(updated.status).toBe(200);

    const { status, data } = await apiRequest(`/audit/project/${projectId}`, ownerToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.logs)).toBe(true);

    const log = data.logs.find((l: any) => l.action === 'project.description_changed' && l.newValues?.description === newDesc);
    expect(log, 'project.description_changed audit entry with the new description').toBeTruthy();
    expect(log.createdAt).toBeTruthy();
    expect(log.actorId).toBeTruthy();
  });

  test('task creation is logged under the task entity', async () => {
    const created = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Audit task ${ts}`, issueType: 'task' }),
    });
    expect(created.status).toBe(201);
    const taskId = created.data.task.taskId;

    const { status, data } = await apiRequest(`/audit/task/${taskId}`, ownerToken);
    expect(status).toBe(200);
    const log = data.logs.find((l: any) => l.action === 'task.created');
    expect(log).toBeTruthy();
    expect(log.newValues.task_key).toBe(created.data.task.taskKey);
  });

  test('label creation is logged under the project_label entity', async () => {
    const created = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/labels`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `audit-label-${ts}` }),
    });
    expect(created.status).toBe(201);
    const labelId = created.data.label.labelId;

    const { status, data } = await apiRequest(`/audit/project_label/${labelId}`, ownerToken);
    expect(status).toBe(200);
    const log = data.logs.find((l: any) => l.action === 'project_label.created');
    expect(log).toBeTruthy();
    expect(log.newValues.name).toBe(`audit-label-${ts}`);
  });

  test('workspace audit log lists workspace-scoped activity', async () => {
    const { data: projData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, ownerToken);
    const workspaceId = projData?.project?.workspaceId || projData?.workspaceId;
    test.skip(!workspaceId, 'Could not resolve workspace id');

    const { status, data } = await apiRequest(`/audit/workspace/${workspaceId}`, ownerToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.logs)).toBe(true);
    expect(data.logs.length).toBeGreaterThan(0);
  });

  test('only owners and admins can view entity audit logs', async () => {
    const { data: projData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, ownerToken);
    const projectId = projData?.project?.projectId || projData?.projectId;
    test.skip(!projectId, 'Project not found');

    for (const email of [TEST_USERS.developer.email, TEST_USERS.viewer.email, TEST_USERS.outsider.email]) {
      const { accessToken } = await apiLogin(email);
      const { status } = await apiRequest(`/audit/project/${projectId}`, accessToken);
      expect(status, `${email} should be denied audit access`).toBe(403);
    }
  });

  test('user audit logs are private (self-only)', async () => {
    const ownerLogin = await apiLogin(TEST_USERS.owner.email);
    const devLogin = await apiLogin(TEST_USERS.developer.email);

    const own = await apiRequest(`/audit/user/${ownerLogin.user.userId || ownerLogin.user.id}`, ownerToken);
    expect(own.status).toBe(200);
    expect(Array.isArray(own.data.logs)).toBe(true);

    const other = await apiRequest(`/audit/user/${devLogin.user.userId || devLogin.user.id}`, ownerToken);
    expect(other.status).toBe(403);
  });

  test('unresolvable entities are rejected with 403', async () => {
    const { status, data } = await apiRequest(
      `/audit/task/${'00000000-0000-4000-8000-000000000000'}`,
      ownerToken
    );
    expect(status).toBe(403);
    expect(data.error).toContain('Cannot resolve access');
  });

  test('audit requires authentication (401)', async () => {
    const { status } = await apiRequest('/audit/project/some-id', '');
    expect(status).toBe(401);
  });
});