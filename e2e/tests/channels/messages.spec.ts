import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const ts = Date.now();

let ownerToken: string;
let developerToken: string;
let viewerToken: string;

let publicChannelId: string;
let privateChannelId: string;
let announcementChannelId: string;

async function createChannel(token: string, body: Record<string, unknown>) {
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  expect(status, `create channel ${JSON.stringify(body)}`).toBe(201);
  return data.channel;
}

test.beforeAll(async () => {
  ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
  developerToken = (await apiLogin(TEST_USERS.developer.email)).accessToken;
  viewerToken = (await apiLogin(TEST_USERS.viewer.email)).accessToken;

  publicChannelId = (await createChannel(ownerToken, { name: `pub-${ts}`, type: 'public' })).channelId;
  privateChannelId = (await createChannel(ownerToken, { name: `priv-${ts}`, type: 'private' })).channelId;
  announcementChannelId = (await createChannel(ownerToken, { name: `ann-${ts}`, type: 'public', isAnnouncementOnly: true })).channelId;
});

test.describe('Channels & Messages', () => {
  // Channels and messages are created once and shared across both suites —
  // tests must run as an ordered sequence in a single worker.
  test.describe.configure({ mode: 'serial' });

test.describe('Channels — access & membership', () => {
  test('create channel requires workspace owner/admin', async () => {
    for (const token of [developerToken, viewerToken]) {
      const { status } = await apiRequest(`/workspaces/${SLUG}/channels`, token, {
        method: 'POST',
        body: JSON.stringify({ name: `nope-${ts}`, type: 'public' }),
      });
      expect(status).toBe(403);
    }
    const outsiderToken = (await apiLogin(TEST_USERS.outsider.email)).accessToken;
    const { status } = await apiRequest(`/workspaces/${SLUG}/channels`, outsiderToken, {
      method: 'POST',
      body: JSON.stringify({ name: `nope-${ts}`, type: 'public' }),
    });
    expect(status).toBe(403);
  });

  test('channel validation rejects bad type and unknown keys', async () => {
    const badType = await apiRequest(`/workspaces/${SLUG}/channels`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `bad-${ts}`, type: 'secret' }),
    });
    expect(badType.status).toBe(400);
    const unknown = await apiRequest(`/workspaces/${SLUG}/channels`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `bad-${ts}`, type: 'public', extra: true }),
    });
    expect(unknown.status).toBe(400);
  });

  test('public channel: any workspace member can read and post', async () => {
    const viewerGet = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}`, viewerToken);
    expect(viewerGet.status).toBe(200);

    const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, viewerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `viewer in public ${ts}` }),
    });
    expect(status).toBe(201);
    expect(data.data.bodyText).toBe(`viewer in public ${ts}`);
  });

  test('private channel: non-member is denied (403) even though workspace member', async () => {
    const get = await apiRequest(`/workspaces/${SLUG}/channels/${privateChannelId}`, viewerToken);
    expect(get.status).toBe(403);
    expect(get.data.error).toContain('private channel');

    const post = await apiRequest(`/workspaces/${SLUG}/channels/${privateChannelId}/messages`, viewerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: 'nope' }),
    });
    expect(post.status).toBe(403);
  });

  test('private channel: owner (member) can read and post', async () => {
    const get = await apiRequest(`/workspaces/${SLUG}/channels/${privateChannelId}`, ownerToken);
    expect(get.status).toBe(200);

    const post = await apiRequest(`/workspaces/${SLUG}/channels/${privateChannelId}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `owner in private ${ts}` }),
    });
    expect(post.status).toBe(201);
  });

  test('outsider cannot access any channel', async () => {
    const outsiderToken = (await apiLogin(TEST_USERS.outsider.email)).accessToken;
    const list = await apiRequest(`/workspaces/${SLUG}/channels`, outsiderToken);
    expect(list.status).toBe(403);
  });

  test('announcement channels: only workspace admins can post', async () => {
    const devPost = await apiRequest(`/workspaces/${SLUG}/channels/${announcementChannelId}/messages`, developerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: 'nope' }),
    });
    expect(devPost.status).toBe(403);
    expect(devPost.data.error).toContain('announcement');

    const ownerPost = await apiRequest(`/workspaces/${SLUG}/channels/${announcementChannelId}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `announcement ${ts}` }),
    });
    expect(ownerPost.status).toBe(201);
  });

  test('join/leave lifecycle on a fresh public channel', async () => {
    const channel = await createChannel(ownerToken, { name: `join-${ts}`, type: 'public' });

    const joinOwner = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/join`, ownerToken, { method: 'POST' });
    expect(joinOwner.status).toBe(409); // creator is auto-member

    const joinDev = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/join`, developerToken, { method: 'POST' });
    expect(joinDev.status).toBe(201);

    const dupJoin = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/join`, developerToken, { method: 'POST' });
    expect(dupJoin.status).toBe(409);

    const leave = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/leave`, developerToken, { method: 'DELETE' });
    expect(leave.status).toBe(200);

    const leaveAgain = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/leave`, developerToken, { method: 'DELETE' });
    expect(leaveAgain.status).toBe(404);
  });
});

test.describe('Messages — CRUD, threads, reactions', () => {
  let parentMessageId: string;
  let viewerMessageId: string;

  test('message validation rejects empty and unknown payloads', async () => {
    const cases = [
      {},
      { bodyText: '' },
      { bodyText: 'x', unknown: 1 },
      { bodyText: 'x'.repeat(10001) },
    ];
    for (const body of cases) {
      const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(status, `send message ${JSON.stringify(body).slice(0, 60)} should be 400`).toBe(400);
      expect(data.error).toBeTruthy();
    }
  });

  test('send + list messages (oldest first, top-level only)', async () => {
    const first = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `first ${ts}` }),
    });
    expect(first.status).toBe(201);
    parentMessageId = first.data.data.messageId;

    const second = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `second ${ts}` }),
    });
    expect(second.status).toBe(201);

    const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken);
    expect(status).toBe(200);
    const texts = data.messages.map((m: any) => m.bodyText);
    expect(texts).toContain(`first ${ts}`);
    expect(texts).toContain(`second ${ts}`);
    expect(texts.indexOf(`first ${ts}`)).toBeLessThan(texts.indexOf(`second ${ts}`));
  });

  test('thread replies increment replyCount and appear in thread list', async () => {
    const reply = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `reply ${ts}`, threadId: parentMessageId }),
    });
    expect(reply.status).toBe(201);
    expect(reply.data.data.threadId).toBe(parentMessageId);

    const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${parentMessageId}/thread`, ownerToken);
    expect(status).toBe(200);
    expect(data.replies.map((r: any) => r.bodyText)).toContain(`reply ${ts}`);

    const { data: list } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken);
    const parent = list.messages.find((m: any) => m.messageId === parentMessageId);
    expect(parent.replyCount).toBeGreaterThanOrEqual(1);
  });

  test('reactions add, list, and remove', async () => {
    const add = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${parentMessageId}/reactions`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ emoji: '👍' }),
    });
    expect(add.status).toBe(200);

    const { data: list } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken);
    const parent = list.messages.find((m: any) => m.messageId === parentMessageId);
    expect(parent.reactions.some((r: any) => r.emoji === '👍')).toBe(true);

    const remove = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${parentMessageId}/reactions/👍`, ownerToken, {
      method: 'DELETE',
    });
    expect(remove.status).toBe(200);

    const { data: after } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken);
    const parentAfter = after.messages.find((m: any) => m.messageId === parentMessageId);
    expect(parentAfter.reactions.some((r: any) => r.emoji === '👍')).toBe(false);
  });

  test('reaction validation rejects empty emoji', async () => {
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${parentMessageId}/reactions`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ emoji: '' }),
    });
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  test('edit: author-only for text, pin by any member', async () => {
    const { data: msg } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, viewerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `viewer edit me ${ts}` }),
    });
    viewerMessageId = msg.data.messageId;

    // owner cannot edit viewer's message
    const ownerEdit = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${viewerMessageId}`, ownerToken, {
      method: 'PATCH',
      body: JSON.stringify({ bodyText: 'hijacked' }),
    });
    expect(ownerEdit.status).toBe(403);

    // viewer can edit own
    const viewerEdit = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${viewerMessageId}`, viewerToken, {
      method: 'PATCH',
      body: JSON.stringify({ bodyText: `viewer edited ${ts}` }),
    });
    expect(viewerEdit.status).toBe(200);
    expect(viewerEdit.data.data.bodyText).toBe(`viewer edited ${ts}`);

    // any member can pin
    const pin = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${viewerMessageId}`, ownerToken, {
      method: 'PATCH',
      body: JSON.stringify({ isPinned: true }),
    });
    expect(pin.status).toBe(200);
    expect(pin.data.data.isPinned).toBe(true);
  });

  test('delete: author-only unless workspace admin', async () => {
    const viewerDelete = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${viewerMessageId}`, viewerToken, {
      method: 'DELETE',
    });
    expect(viewerDelete.status).toBe(200); // viewer deletes own message

    // owner deletes developer's message (admin override)
    const { data: devMsg } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, developerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `dev delete me ${ts}` }),
    });
    const ownerDelete = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${devMsg.data.messageId}`, ownerToken, {
      method: 'DELETE',
    });
    expect(ownerDelete.status).toBe(200);

    // viewer cannot delete owner's message
    const { data: ownerMsg } = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `owner delete test ${ts}` }),
    });
    const viewerDeleteOwner = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages/${ownerMsg.data.messageId}`, viewerToken, {
      method: 'DELETE',
    });
    expect(viewerDeleteOwner.status).toBe(403);
  });

  test('message endpoints require authentication (401)', async () => {
    const list = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, '');
    expect(list.status).toBe(401);
    const post = await apiRequest(`/workspaces/${SLUG}/channels/${publicChannelId}/messages`, '', {
      method: 'POST',
      body: JSON.stringify({ bodyText: 'x' }),
    });
    expect(post.status).toBe(401);
  });
});});
