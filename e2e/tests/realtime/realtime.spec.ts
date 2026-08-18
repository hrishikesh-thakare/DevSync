import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, API_URL } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';
import { io } from 'socket.io-client';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;
const SOCKET_URL = API_URL.replace(/\/api$/, '');

async function connectSocket(accessToken: string) {
  const socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
  });
  return socket;
}

test.describe('Realtime (WebSockets)', () => {
  test('socket receives new_message event', async () => {
    // 1. REST login as owner
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    
    // 2. Get first channel
    const { data: channelsData } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken);
    const channel = (channelsData?.channels || channelsData || [])[0];
    if (!channel) { test.skip(); return; }
    
    const channelId = channel.channelId || channel.id || channel.channel_id;

    // Join channel via REST so we have permission
    await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/join`, accessToken, { method: 'POST' });

    // 3. Connect Socket.IO client
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket']
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
    });

    // Join room
    socket.emit('join_room', `channel:${channelId}`);

    // 4. Send message via REST API
    const testText = `Realtime E2E test ${Date.now()}`;

    // Promise that resolves when the message is received (any message matching
    // our test text — other suites may post to the same channel concurrently)
    const messagePromise = new Promise<any>((resolve, reject) => {
      socket.on('new_message', (msg) => {
        const text = msg.bodyText || msg.body_text || msg.message?.bodyText;
        if (text === testText) resolve(msg);
      });
      setTimeout(() => reject(new Error('Timeout waiting for message')), 15000);
    });

    const { status } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, accessToken, {
      method: 'POST', body: JSON.stringify({ bodyText: testText })
    });
    expect(status).toBe(201);

    // 5. Assert socket received it
    const received = await messagePromise;
    expect(received).toBeTruthy();
    expect(received.bodyText || received.body_text || received.message?.bodyText).toBe(testText);

    // Cleanup
    socket.disconnect();
  });

  test('socket receives message_updated, message_reaction and message_deleted events', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);

    // Fresh channel so we never collide with other suites' messages
    const { data: created } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: `rt-lifecycle-${Date.now()}`, type: 'public' }),
    });
    const channelId = created?.channel?.channelId || created?.channelId;
    if (!channelId) { test.skip(); return; }

    const socket = await connectSocket(accessToken);
    socket.emit('join_room', `channel:${channelId}`);
    await new Promise((r) => setTimeout(r, 300));

    const { data: sent } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `rt lifecycle ${Date.now()}` }),
    });
    const messageId = sent?.data?.messageId || sent?.data?.message_id || sent?.messageId;
    expect(messageId).toBeTruthy();

    // ── message_updated ──
    const updatedPromise = new Promise<any>((resolve, reject) => {
      socket.on('message_updated', (m) => {
        const id = m.messageId || m.message?.messageId;
        if (id === messageId) resolve(m);
      });
      setTimeout(() => reject(new Error('Timeout waiting for message_updated')), 15000);
    });
    const edit = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${messageId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ bodyText: `rt lifecycle edited ${Date.now()}` }),
    });
    expect(edit.status).toBe(200);
    const updated = await updatedPromise;
    expect(updated).toBeTruthy();

    // ── message_reaction_added / removed ──
    const reactionAddedPromise = new Promise<any>((resolve, reject) => {
      socket.on('message_reaction_added', (ev) => {
        if (ev.messageId === messageId && ev.emoji === '👍') resolve(ev);
      });
      setTimeout(() => reject(new Error('Timeout waiting for message_reaction_added')), 15000);
    });
    const react = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${messageId}/reactions`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ emoji: '👍' }),
    });
    expect([200, 201]).toContain(react.status);
    const reacted = await reactionAddedPromise;
    expect(reacted).toBeTruthy();

    const reactionRemovedPromise = new Promise<any>((resolve, reject) => {
      socket.on('message_reaction_removed', (ev) => {
        if (ev.messageId === messageId && ev.emoji === '👍') resolve(ev);
      });
      setTimeout(() => reject(new Error('Timeout waiting for message_reaction_removed')), 15000);
    });
    const unreact = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${messageId}/reactions/%F0%9F%91%8D`, accessToken, {
      method: 'DELETE',
    });
    expect([200, 204]).toContain(unreact.status);
    const unreacted = await reactionRemovedPromise;
    expect(unreacted).toBeTruthy();

    // ── message_deleted ──
    const deletedPromise = new Promise<any>((resolve, reject) => {
      socket.on('message_deleted', (ev) => {
        if (ev.messageId === messageId) resolve(ev);
      });
      setTimeout(() => reject(new Error('Timeout waiting for message_deleted')), 15000);
    });
    const del = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${messageId}`, accessToken, {
      method: 'DELETE',
    });
    expect([200, 204]).toContain(del.status);
    const deleted = await deletedPromise;
    expect(deleted).toBeTruthy();

    socket.disconnect();
  });

  test('socket receives user_presence_updated when own status changes', async () => {
    const { accessToken, user } = await apiLogin(TEST_USERS.owner.email);
    const userId = user?.userId || user?.id;
    const statusText = `E2E presence ${Date.now()}`;

    const socket = await connectSocket(accessToken);

    const presencePromise = new Promise<any>((resolve, reject) => {
      socket.on('user_presence_updated', (ev) => {
        if (ev.userId === userId && ev.statusText === statusText) resolve(ev);
      });
      setTimeout(() => reject(new Error('Timeout waiting for user_presence_updated')), 15000);
    });

    const { status } = await apiRequest('/auth/status', accessToken, {
      method: 'POST',
      body: JSON.stringify({ statusText, presence: 'busy' }),
    });
    expect(status).toBe(200);

    const received = await presencePromise;
    expect(received.presence).toBe('busy');

    socket.disconnect();
  });

  test('socket receives new_notification when a task is assigned to me', async () => {
    const dev = await apiLogin(TEST_USERS.developer.email);
    const devUserId = dev.user?.userId || dev.user?.id;
    const owner = await apiLogin(TEST_USERS.owner.email);

    const socket = await connectSocket(dev.accessToken); // auto-joins user:<devUserId>

    const notifPromise = new Promise<any>((resolve, reject) => {
      socket.on('new_notification', (n) => {
        if (n.type === 'task_assigned' && n.recipientId === devUserId) resolve(n);
      });
      setTimeout(() => reject(new Error('Timeout waiting for new_notification')), 15000);
    });

    const { data: created } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, owner.accessToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Socket notify ${Date.now()}`, issueType: 'task', assigneeId: devUserId }),
    });
    const taskId = created?.task?.taskId || created?.taskId;
    expect(taskId).toBeTruthy();

    const received = await notifPromise;
    expect(received.entityId).toBe(taskId);
    expect(received.title).toBeTruthy();

    socket.disconnect();
  });

  test('socket connection is rejected with an invalid token', async () => {
    const socket = io(SOCKET_URL, {
      auth: { token: 'invalid.token.value' },
      transports: ['websocket'],
    });

    const error = await new Promise<string | Error>((resolve, reject) => {
      socket.on('connect', () => reject(new Error('Socket connected despite invalid token')));
      socket.on('connect_error', (err) => resolve(err.message));
      setTimeout(() => reject(new Error('No connect_error received')), 5000);
    });
    expect(error).toBeTruthy();
    socket.disconnect();
  });

  test('socket connection is rejected without a token', async () => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    const error = await new Promise<string | Error>((resolve, reject) => {
      socket.on('connect', () => reject(new Error('Socket connected without a token')));
      socket.on('connect_error', (err) => resolve(err.message));
      setTimeout(() => reject(new Error('No connect_error received')), 5000);
    });
    expect(error).toBeTruthy();
    socket.disconnect();
  });
});
