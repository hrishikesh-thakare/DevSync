import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Notifications', () => {
  test('can list own notifications via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest('/notifications', accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data?.notifications || data)).toBe(true);
  });

  test('assigning a task notifies the assignee', async () => {
    const ownerLogin = await apiLogin(TEST_USERS.owner.email);
    const devLogin = await apiLogin(TEST_USERS.developer.email);

    const { status } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerLogin.accessToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Assigned ${Date.now()}`, issueType: 'task', assigneeId: devLogin.user.userId || devLogin.user.id }),
    });
    expect([200, 201]).toContain(status);

    const { data } = await apiRequest('/notifications', devLogin.accessToken);
    const found = (data?.notifications || data || []).some((n: any) => n.type === 'task_assigned');
    expect(found).toBe(true);
  });

  test('can mark a notification as read', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const { data } = await apiRequest('/notifications', accessToken);
    const notif = (data?.notifications || data || [])[0];
    if (!notif) { test.skip(); return; }
    const { status } = await apiRequest(`/notifications/${notif.notificationId || notif.id}/read`, accessToken, { method: 'PATCH' });
    expect(status).toBe(200);
  });

  test('can mark all as read', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const { status } = await apiRequest('/notifications/read-all', accessToken, { method: 'PATCH' });
    expect(status).toBe(200);
  });
});
