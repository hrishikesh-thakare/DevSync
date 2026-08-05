import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS, API_URL } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';
import { io } from 'socket.io-client';

const SLUG = TEST_WORKSPACE.slug;
const SOCKET_URL = API_URL.replace(/\/api$/, '');

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

    // Promise that resolves when the message is received
    const messagePromise = new Promise<any>((resolve, reject) => {
      socket.on('new_message', (msg) => {
        resolve(msg);
      });
      setTimeout(() => reject(new Error('Timeout waiting for message')), 10000);
    });

    // 4. Send message via REST API
    const testText = `Realtime E2E test ${Date.now()}`;
    const { status } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, accessToken, {
      method: 'POST', body: JSON.stringify({ bodyText: testText })
    });
    expect([200, 201]).toContain(status);

    // 5. Assert socket received it
    const received = await messagePromise;
    expect(received).toBeTruthy();
    expect(received.bodyText || received.body_text || received.message?.bodyText).toBe(testText);

    // Cleanup
    socket.disconnect();
  });
});
