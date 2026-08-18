import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Notifications', () => {
  let ownerToken: string;
  let devToken: string;

  test.beforeAll(async () => {
    ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
    devToken = (await apiLogin(TEST_USERS.developer.email)).accessToken;
  });

  test('assigning a task notifies the assignee', async () => {
    const devLogin = await apiLogin(TEST_USERS.developer.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Assigned ${Date.now()}`, issueType: 'task', assigneeId: devLogin.user.userId || devLogin.user.id }),
    });
    expect([200, 201]).toContain(status);

    const { data } = await apiRequest('/notifications', devToken);
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(data.notifications.some((n: any) => n.type === 'task_assigned')).toBe(true);
  });

  test('notification records have the expected fields', async () => {
    const { status, data } = await apiRequest('/notifications', devToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.notifications)).toBe(true);
    const notif = data.notifications[0];
    if (notif) {
      expect(notif.notificationId).toBeTruthy();
      expect(typeof notif.isRead).toBe('boolean');
      expect(notif.type).toBeTruthy();
    }
  });

  test('unreadOnly=true returns only unread notifications', async () => {
    const { data } = await apiRequest('/notifications?unreadOnly=true', devToken);
    expect(Array.isArray(data.notifications)).toBe(true);
    for (const n of data.notifications) {
      expect(n.isRead).toBe(false);
    }
  });

  test('can mark a notification as read', async () => {
    const { data } = await apiRequest('/notifications?unreadOnly=true', devToken);
    const notif = data.notifications[0];
    test.skip(!notif, 'No unread notifications for developer');

    const { status } = await apiRequest(`/notifications/${notif.notificationId}/read`, devToken, { method: 'PATCH' });
    expect(status).toBe(200);

    const { data: after } = await apiRequest('/notifications?unreadOnly=true', devToken);
    expect(after.notifications.some((n: any) => n.notificationId === notif.notificationId)).toBe(false);
  });

  test('cannot mark another user\'s notification as read (404)', async () => {
    const { data: devNotifs } = await apiRequest('/notifications', devToken);
    const notif = devNotifs.notifications.find((n: any) => n.type === 'task_assigned');
    test.skip(!notif, 'No assignable notification for developer');

    const { status, data } = await apiRequest(`/notifications/${notif.notificationId}/read`, ownerToken, { method: 'PATCH' });
    expect(status).toBe(404);
    expect(data.error).toBe('Notification not found.');
  });

  test('can mark all notifications as read', async () => {
    const { status } = await apiRequest('/notifications/read-all', devToken, { method: 'PATCH' });
    expect(status).toBe(200);

    const { data } = await apiRequest('/notifications?unreadOnly=true', devToken);
    expect(data.notifications).toEqual([]);
  });

  test('resolve returns a deep link for own notification, 404 otherwise', async () => {
    const { data: devNotifs } = await apiRequest('/notifications', devToken);
    const notif = devNotifs.notifications.find((n: any) => n.type === 'task_assigned');
    test.skip(!notif, 'No assignable notification for developer');

    const mine = await apiRequest(`/notifications/${notif.notificationId}/resolve`, devToken);
    expect(mine.status).toBe(200);
    expect(typeof mine.data.url).toBe('string');

    const other = await apiRequest(`/notifications/${notif.notificationId}/resolve`, ownerToken);
    expect(other.status).toBe(404);
  });

  test('unauthenticated requests are rejected with 401', async () => {
    const list = await apiRequest('/notifications', '');
    expect(list.status).toBe(401);
    const readAll = await apiRequest('/notifications/read-all', '', { method: 'PATCH' });
    expect(readAll.status).toBe(401);
  });
});