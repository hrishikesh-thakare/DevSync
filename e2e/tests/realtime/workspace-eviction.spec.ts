import { test, expect } from '@playwright/test';
import { TEST_WORKSPACE, TEST_USERS, TEST_PASSWORD, API_URL } from '../../helpers/constants.js';
import { apiLogin, apiRequest, verifyEmail } from '../../helpers/api-helpers.js';
import { io, type Socket } from 'socket.io-client';

/**
 * A socket only joins `workspace:{id}` once, on connect — membership is
 * re-checked there but nowhere else. Removing someone from a workspace used
 * to do nothing to a socket they already had open: they kept receiving
 * `user_presence_updated` and every other workspace broadcast until they
 * happened to disconnect and reconnect on their own. The fix is
 * `evictFromWorkspaceRoom` in `workspaces.controller.ts`, called from both
 * `removeMember` and `leaveWorkspace`, which reaches every live connection a
 * user has via their personal `user:{userId}` room and evicts it from the
 * workspace room directly — no reconnect required.
 */

const SLUG = TEST_WORKSPACE.slug;
const SOCKET_URL = API_URL.replace(/\/api$/, '');

function waitForPresence(socket: Socket, statusText: string, ms: number) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('user_presence_updated', handler);
      reject(new Error('Timed out waiting for user_presence_updated'));
    }, ms);
    const handler = (payload: any) => {
      if (payload?.statusText !== statusText) return;
      clearTimeout(timer);
      socket.off('user_presence_updated', handler);
      resolve(payload);
    };
    socket.on('user_presence_updated', handler);
  });
}

const connected = (socket: Socket) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 8000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

test('removing a member evicts their already-open socket from the workspace room', async () => {
  const ownerLogin = await apiLogin(TEST_USERS.owner.email);

  // A throwaway member, invited and accepted the same way workspace-members.spec.ts does it.
  const email = `evict-test-${Date.now()}@demo.com`;
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName: 'Evict Test', password: TEST_PASSWORD }),
  });
  expect(regRes.ok).toBe(true);
  const regData = await regRes.json();
  const memberUserId = regData.user.userId;
  await verifyEmail(regData);

  await apiRequest(`/workspaces/${SLUG}/invite`, ownerLogin.accessToken, {
    method: 'POST',
    body: JSON.stringify({ email, role: 'member' }),
  });

  const memberLogin = await apiLogin(email);
  await apiRequest(`/workspaces/${SLUG}/invites/accept`, memberLogin.accessToken, { method: 'POST' });

  const socket: Socket = io(SOCKET_URL, { auth: { token: memberLogin.accessToken }, transports: ['websocket'] });
  try {
    await connected(socket);

    // Baseline: the fresh member's socket is genuinely in the workspace room —
    // an unrelated presence change from the owner reaches it.
    const before = `evict-before-${Date.now()}`;
    const beforeSeen = waitForPresence(socket, before, 8000);
    expect(
      (
        await apiRequest('/auth/status', ownerLogin.accessToken, {
          method: 'POST',
          body: JSON.stringify({ statusText: before }),
        })
      ).status,
    ).toBe(200);
    await expect(beforeSeen).resolves.toBeTruthy();

    // Remove them — no reconnect happens on their end, the socket above stays
    // open exactly as it was.
    const removeStatus = (
      await apiRequest(`/workspaces/${SLUG}/members/${memberUserId}`, ownerLogin.accessToken, {
        method: 'DELETE',
      })
    ).status;
    expect([200, 204]).toContain(removeStatus);

    // Same broadcast again. Without eviction this socket would still be
    // sitting in `workspace:{id}` and would see it; with eviction it hears
    // nothing before the timeout.
    const after = `evict-after-${Date.now()}`;
    const afterSeen = waitForPresence(socket, after, 3000);
    expect(
      (
        await apiRequest('/auth/status', ownerLogin.accessToken, {
          method: 'POST',
          body: JSON.stringify({ statusText: after }),
        })
      ).status,
    ).toBe(200);
    await expect(afterSeen).rejects.toThrow(/Timed out/);
  } finally {
    socket.disconnect();
    // Cleanup: reset the owner's status so it doesn't leak into other tests
    // that assert on it, and soft-delete the throwaway account — removing it
    // from the workspace above only deactivates the membership row, the
    // `users` row itself stays until this.
    await apiRequest('/auth/status', ownerLogin.accessToken, {
      method: 'POST',
      body: JSON.stringify({ statusText: '' }),
    });
    await apiRequest('/auth/me', memberLogin.accessToken, { method: 'DELETE' });
  }
});
