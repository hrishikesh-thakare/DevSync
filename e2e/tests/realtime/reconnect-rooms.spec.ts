import { test, expect } from '@playwright/test';
import { TEST_WORKSPACE, TEST_USERS, API_URL } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';
import { io, type Socket } from 'socket.io-client';

/**
 * Room membership must survive a reconnect.
 *
 * This is the behaviour that was broken: the server puts a socket into its
 * `user:` and `workspace:` rooms itself on connect, but `project:` and
 * `channel:` rooms are joined only when the client asks. A reconnect gives the
 * server a brand-new socket with none of those rooms, and the client's mount
 * effect does not re-run — so after a network blip the UI looked connected and
 * silently stopped receiving messages.
 *
 * The fix lives in `frontend/src/lib/socket.ts`, which replays every wanted
 * room from the `connect` handler. These tests assert the contract that fix
 * depends on, from the wire side: rooms are per-connection, and a client that
 * rejoins after reconnecting receives events again.
 */

const SLUG = TEST_WORKSPACE.slug;
const SOCKET_URL = API_URL.replace(/\/api$/, '');

function waitFor(socket: Socket, event: string, match: (payload: any) => boolean, ms = 8000) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, ms);
    const handler = (payload: any) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
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

test.describe('Realtime — rooms after reconnect', () => {
  let token: string;
  let channelId: string;
  let socket: Socket;

  test.beforeAll(async () => {
    token = (await apiLogin(TEST_USERS.owner.email)).accessToken;

    const { data } = await apiRequest(`/workspaces/${SLUG}/channels`, token);
    const channel = (data.channels ?? []).find(
      (c: { type: string; isArchived?: boolean }) => c.type === 'public' && !c.isArchived,
    );
    expect(channel, 'seed should provide a public channel').toBeTruthy();
    channelId = channel.channelId;

    await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/join`, token, { method: 'POST' });
  });

  test.afterEach(() => {
    socket?.disconnect();
  });

  test('a reconnected socket that rejoins receives messages again', async () => {
    socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    await connected(socket);

    const room = `channel:${channelId}`;
    const join = () => socket.emit('join_room', room);
    const post = (bodyText: string) =>
      apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ bodyText }),
      });

    // Baseline: joined, so the event arrives.
    join();
    const before = `reconnect-before-${Date.now()}`;
    const firstSeen = waitFor(socket, 'new_message', (m) => m?.bodyText === before);
    expect((await post(before)).status).toBe(201);
    await expect(firstSeen).resolves.toBeTruthy();

    // Force a genuine reconnect. The server sees a disconnect and then a new
    // connection with a new socket id, which is exactly what a laptop waking
    // from sleep produces.
    const reconnected = connected(socket);
    socket.io.engine.close();
    await reconnected;

    // Replaying the join is what the fixed client does from its `connect`
    // handler. Without it the next assertion is the bug.
    join();

    const after = `reconnect-after-${Date.now()}`;
    const secondSeen = waitFor(socket, 'new_message', (m) => m?.bodyText === after);
    expect((await post(after)).status).toBe(201);
    await expect(secondSeen).resolves.toBeTruthy();
  });

  test('rooms do not survive a reconnect on their own', async () => {
    // The premise of the fix, asserted directly: after reconnecting *without*
    // rejoining, the socket hears nothing. If this ever starts passing without
    // a rejoin, the server began restoring rooms itself and the client-side
    // replay can be simplified.
    socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    await connected(socket);
    socket.emit('join_room', `channel:${channelId}`);

    const reconnected = connected(socket);
    socket.io.engine.close();
    await reconnected;

    const orphaned = `reconnect-orphan-${Date.now()}`;
    const seen = waitFor(socket, 'new_message', (m) => m?.bodyText === orphaned, 3000);
    expect(
      (
        await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, token, {
          method: 'POST',
          body: JSON.stringify({ bodyText: orphaned }),
        })
      ).status,
    ).toBe(201);

    await expect(seen).rejects.toThrow(/Timed out/);
  });

  test('the server refuses a room the user cannot access', async () => {
    socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    await connected(socket);

    const denied = waitFor(socket, 'room_join_denied', () => true, 5000);
    socket.emit('join_room', 'channel:00000000-0000-4000-8000-000000000000');

    // The client now listens for this and drops the room instead of waiting
    // forever for events that are never coming.
    await expect(denied).resolves.toBeTruthy();
  });
});
