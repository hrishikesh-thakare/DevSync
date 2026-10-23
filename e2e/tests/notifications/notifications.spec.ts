import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, TEST_PASSWORD } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Notifications', () => {
  let ownerToken: string;
  let devToken: string;

  test.beforeAll(async () => {
    ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
    devToken = (await apiLogin(TEST_USERS.developer.email)).accessToken;

    // Guarantee dave has a task_assigned notification regardless of what
    // parallel specs do, so no test below skips for missing data.
    const devLogin = await apiLogin(TEST_USERS.developer.email);
    await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Guaranteed ${Date.now()}`, issueType: 'task', assigneeId: devLogin.user.userId || devLogin.user.id }),
    });
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
    // Use a dedicated fresh user: parallel specs keep assigning dave new
    // tasks mid-run, so asserting on dave's queue can never be deterministic.
    const email = `readall-${Date.now()}@demo.com`;
    const { status: regStatus, data: regData } = await apiRequest('/auth/register', '', {
      method: 'POST',
      body: JSON.stringify({ email, fullName: 'ReadAll Tester', password: TEST_PASSWORD }),
    });
    expect([200, 201]).toContain(regStatus);
    const freshToken = regData.accessToken;

    // Give them exactly one notification: inviting an existing user creates a
    // workspace_invited notification for them (no membership chain needed,
    // and no other spec can create notifications for a fresh user).
    const { status: inviteStatus } = await apiRequest(`/workspaces/${SLUG}/invite`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ email, role: 'member' }),
    });
    expect(inviteStatus).toBe(201);

    const { data: before } = await apiRequest('/notifications?unreadOnly=true', freshToken);
    expect(before.notifications.length).toBeGreaterThan(0);

    const { status } = await apiRequest('/notifications/read-all', freshToken, { method: 'PATCH' });
    expect(status).toBe(200);

    const { data: after } = await apiRequest('/notifications?unreadOnly=true', freshToken);
    expect(after.notifications).toEqual([]);
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

  test('notifications are strictly scoped per workspace and mark-all is isolated', async () => {
    // 1. Register a dedicated test user
    const email = `scope-${Date.now()}@demo.com`;
    const { status: regStatus, data: regData } = await apiRequest('/auth/register', '', {
      method: 'POST',
      body: JSON.stringify({ email, fullName: 'Scope Tester', password: TEST_PASSWORD }),
    });
    expect([200, 201]).toContain(regStatus);
    const scopeToken = regData.accessToken;

    // 2. Create a second workspace
    const ws2Slug = `scope-ws-${Date.now()}`;
    const { status: wsStatus } = await apiRequest('/workspaces', ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Scope WS2', slug: ws2Slug }),
    });
    expect(wsStatus).toBe(201);

    try {
      // 3. Invite user to Workspace 1 (SLUG)
      const { status: inv1 } = await apiRequest(`/workspaces/${SLUG}/invite`, ownerToken, {
        method: 'POST',
        body: JSON.stringify({ email, role: 'member' }),
      });
      expect(inv1).toBe(201);

      // 4. Invite user to Workspace 2 (ws2Slug)
      const { status: inv2 } = await apiRequest(`/workspaces/${ws2Slug}/invite`, ownerToken, {
        method: 'POST',
        body: JSON.stringify({ email, role: 'member' }),
      });
      expect(inv2).toBe(201);

      // 5. Query notifications scoped to Workspace 1 via route
      const { data: ws1Notifs } = await apiRequest(`/workspaces/${SLUG}/notifications`, scopeToken);
      expect(ws1Notifs.notifications.length).toBeGreaterThan(0);
      expect(ws1Notifs.notifications.every((n: any) => n.workspaceSlug === SLUG)).toBe(true);

      // 6. Query notifications scoped to Workspace 2 via route
      const { data: ws2Notifs } = await apiRequest(`/workspaces/${ws2Slug}/notifications`, scopeToken);
      expect(ws2Notifs.notifications.length).toBeGreaterThan(0);
      expect(ws2Notifs.notifications.every((n: any) => n.workspaceSlug === ws2Slug)).toBe(true);

      // 7. Verify cross-contamination does NOT occur
      const ws1HasWs2Notifs = ws1Notifs.notifications.some((n: any) => n.workspaceSlug === ws2Slug);
      const ws2HasWs1Notifs = ws2Notifs.notifications.some((n: any) => n.workspaceSlug === SLUG);
      expect(ws1HasWs2Notifs).toBe(false);
      expect(ws2HasWs1Notifs).toBe(false);

      // 8. Mark all read in Workspace 1 ONLY
      const { status: readAllStatus } = await apiRequest(`/workspaces/${SLUG}/notifications/read-all`, scopeToken, {
        method: 'PATCH',
      });
      expect(readAllStatus).toBe(200);

      // 9. Verify Workspace 1 unread notifications are now empty
      const { data: ws1UnreadAfter } = await apiRequest(`/workspaces/${SLUG}/notifications?unreadOnly=true`, scopeToken);
      expect(ws1UnreadAfter.notifications).toEqual([]);

      // 10. Verify Workspace 2 unread notifications remain untouched (still unread)
      const { data: ws2UnreadAfter } = await apiRequest(`/workspaces/${ws2Slug}/notifications?unreadOnly=true`, scopeToken);
      expect(ws2UnreadAfter.notifications.length).toBeGreaterThan(0);
      expect(ws2UnreadAfter.notifications.every((n: any) => n.isRead === false)).toBe(true);
    } finally {
      // Clean up the created workspace
      await apiRequest(`/workspaces/${ws2Slug}`, ownerToken, { method: 'DELETE' });
    }
  });
});