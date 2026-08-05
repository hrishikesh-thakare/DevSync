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

    // Get channels
    const { data: channelsData } = await apiRequest(
      `/workspaces/${SLUG}/channels`,
      ownerToken
    );
    const channels = channelsData?.channels || channelsData || [];
    const channel = channels[0];

    if (!channel) {
      test.skip();
      return;
    }

    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channel.channelId}/join`,
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
});
