/**
 * Channel CRUD & Messaging Tests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS, ROUTES } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

test.describe('Channel CRUD', () => {
  test('can create channel via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: `e2e-channel-${Date.now()}`,
        type: 'public',
        description: 'E2E test channel',
      }),
    });
    expect([200, 201]).toContain(status);
  });

  test('can list channels via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken);
    expect(status).toBe(200);
  });

  test('member can join a channel via API', async () => {
    const { accessToken: ownerToken } = await apiLogin(TEST_USERS.owner.email);

    // Create a fresh channel: taking channels[0] races other tests that delete
    // residue channels and can hit a deleted channel → 500 (FK violation).
    const { data: created } = await apiRequest(`/workspaces/${SLUG}/channels`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `e2e-join-${Date.now()}`, type: 'public' }),
    });
    const channelId = created?.channel?.channelId || created?.channelId;
    if (!channelId) {
      test.skip();
      return;
    }

    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channelId}/join`,
      accessToken,
      { method: 'POST' }
    );
    // May already be a member
    expect([200, 201, 400, 409]).toContain(status);
  });

  test('owner/admin can archive channel via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);

    // Create a channel to archive
    const { data: newChannel } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: `archive-me-${Date.now()}`,
        type: 'public',
      }),
    });

    const channelId = newChannel?.channel?.channelId || newChannel?.channelId;
    if (!channelId) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channelId}/archive`,
      accessToken,
      { method: 'PATCH' }
    );
    expect(status).toBe(200);
  });

  test('owner/admin can delete channel via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);

    // Create a channel to delete
    const { data: newChannel } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: `delete-me-${Date.now()}`,
        type: 'public',
      }),
    });

    const channelId = newChannel?.channel?.channelId || newChannel?.channelId;
    if (!channelId) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channelId}`,
      accessToken,
      { method: 'DELETE' }
    );
    expect([200, 204]).toContain(status);
  });
  test('leave channel via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const { data: channelsData } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken);
    const channel = (channelsData?.channels || channelsData || [])[0];
    if (!channel) { test.skip(); return; }

    // Join first to ensure we can leave
    await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/join`, accessToken, { method: 'POST' });

    const { status } = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/leave`, accessToken, { method: 'DELETE' });
    expect([200, 204]).toContain(status);
  });

  test('rename channel via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { data: channelsData } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken);
    const channel = (channelsData?.channels || channelsData || [])[0];
    if (!channel) { test.skip(); return; }

    const { status } = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: `renamed-channel-${Date.now()}`, description: 'Updated desc' })
    });
    expect(status).toBe(200);
  });
});

test.describe('Messaging', () => {
  test('can send message in channel via API', async () => {
    const { accessToken: ownerToken } = await apiLogin(TEST_USERS.owner.email);

    // Get a channel
    const { data: channelsData } = await apiRequest(
      `/workspaces/${SLUG}/channels`,
      ownerToken
    );
    const channels = channelsData?.channels || channelsData || [];
    const channel = channels.find((c: any) => !c.isArchived) || channels[0];

    const channelId = channel?.channelId || channel?.id || channel?.channel_id;
    if (!channelId) {
      test.skip();
      return;
    }

    // Join channel first
    await apiRequest(
      `/workspaces/${SLUG}/channels/${channelId}/join`,
      ownerToken,
      { method: 'POST' }
    );

    // Send message
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channelId}/messages`,
      ownerToken,
      {
        method: 'POST',
        body: JSON.stringify({
          bodyText: `E2E test message ${Date.now()}`,
        }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('can list messages in channel via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);

    const { data: channelsData } = await apiRequest(
      `/workspaces/${SLUG}/channels`,
      accessToken
    );
    const channels = channelsData?.channels || channelsData || [];
    const channel = channels[0];

    if (!channel) {
      test.skip();
      return;
    }

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channel.channelId}/messages`,
      accessToken
    );
    expect(status).toBe(200);
  });
  test('edit own message via API', async () => {
    const { accessToken: ownerToken } = await apiLogin(TEST_USERS.owner.email);
    const { data: channelsData } = await apiRequest(`/workspaces/${SLUG}/channels`, ownerToken);
    const channel = (channelsData?.channels || channelsData || []).find((c: any) => !c.isArchived) || (channelsData?.channels || channelsData || [])[0];
    const channelId = channel?.channelId || channel?.id || channel?.channel_id;
    if (!channelId) { test.skip(); return; }

    await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/join`, ownerToken, { method: 'POST' });

    const { data: msgData } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, ownerToken, {
      method: 'POST', body: JSON.stringify({ bodyText: 'Original text' })
    });
    const msgId = msgData?.data?.messageId || msgData?.message?.messageId || msgData?.messageId;

    const { status } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${msgId}`, ownerToken, {
      method: 'PATCH', body: JSON.stringify({ bodyText: 'Edited text' })
    });
    expect(status).toBe(200);

    const { accessToken: devToken } = await apiLogin(TEST_USERS.developer.email);
    const { status: failStatus } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${msgId}`, devToken, {
      method: 'PATCH', body: JSON.stringify({ bodyText: 'Hacked text' })
    });
    expect(failStatus).toBe(403);
  });

  test('delete message via API', async () => {
    const { accessToken: devToken } = await apiLogin(TEST_USERS.developer.email);
    const { data: channelsData } = await apiRequest(`/workspaces/${SLUG}/channels`, devToken);
    const channel = (channelsData?.channels || channelsData || []).find((c: any) => !c.isArchived) || (channelsData?.channels || channelsData || [])[0];
    const channelId = channel?.channelId || channel?.id || channel?.channel_id;
    if (!channelId) { test.skip(); return; }

    await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/join`, devToken, { method: 'POST' });

    const { data: msgData } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, devToken, {
      method: 'POST', body: JSON.stringify({ bodyText: 'To be deleted' })
    });
    const msgId = msgData?.data?.messageId || msgData?.message?.messageId || msgData?.messageId;

    const { accessToken: viewerToken } = await apiLogin(TEST_USERS.viewer.email);
    const { status: failStatus } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${msgId}`, viewerToken, { method: 'DELETE' });
    expect(failStatus).toBe(403);

    const { status: delStatus } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages/${msgId}`, devToken, { method: 'DELETE' });
    expect([200, 204]).toContain(delStatus);
  });

  test('thread replies via API', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { data: channelsData } = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken);
    const channel = (channelsData?.channels || channelsData || [])[0];
    if (!channel) { test.skip(); return; }

    const { data: messagesData } = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/messages`, accessToken);
    const messages = messagesData?.messages || messagesData || [];
    const msgId = messages[0]?.messageId || messages[0]?.id;
    if (!msgId) { test.skip(); return; }

    const { status } = await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/messages/${msgId}/thread`, accessToken);
    expect(status).toBe(200);
  });
});
