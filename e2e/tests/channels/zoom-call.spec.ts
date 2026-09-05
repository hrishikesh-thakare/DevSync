import { test, expect } from '@playwright/test';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

/**
 * Zoom "Start call" link-out — previously zero coverage. Unlike GitHub
 * (whose OAuth exchange needs a live GitHub account this environment has no
 * way to authenticate as), real Server-to-Server Zoom credentials ARE
 * configured here (`ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`),
 * so this hits the actual Zoom API rather than stopping at a "not
 * configured" error path. `startCall` reuses one meeting per channel
 * (`getActiveCall`'s in-memory TTL cache) and `endCall` deletes it on Zoom's
 * side too, so this test's own call is fully cleaned up by its last step —
 * it doesn't leave a live meeting behind on the shared Zoom account.
 *
 * Runs on a disposable channel rather than a shared fixture one: the
 * "already active" branch (`POST` again returns the same `joinUrl` instead
 * of minting a second meeting) means two copies of this test racing on the
 * same channel would observe each other's meeting, which a private channel
 * makes impossible.
 */

const SLUG = TEST_WORKSPACE.slug;

test('starting a call creates a real Zoom meeting; ending it clears the link', async () => {
  const owner = await apiLogin(TEST_USERS.owner.email);

  const { status: createStatus, data: channelData } = await apiRequest(`/workspaces/${SLUG}/channels`, owner.accessToken, {
    method: 'POST',
    body: JSON.stringify({ name: `zoom-e2e-${Date.now()}`, type: 'public' }),
  });
  expect(createStatus).toBe(201);
  const channelId = channelData.channel.channelId;

  try {
    const before = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/call`, owner.accessToken);
    expect(before.status).toBe(200);
    expect(before.data.joinUrl).toBeNull();

    const started = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/call`, owner.accessToken, {
      method: 'POST',
    });
    expect(started.status).toBe(201); // a genuinely new meeting
    expect(started.data.joinUrl).toMatch(/^https:\/\/([\w-]+\.)?zoom\.us\//);

    // Starting again while one is already active reuses it rather than
    // minting a second meeting — 200, not 201, and the same link.
    const startedAgain = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/call`, owner.accessToken, {
      method: 'POST',
    });
    expect(startedAgain.status).toBe(200);
    expect(startedAgain.data.joinUrl).toBe(started.data.joinUrl);

    const ended = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/call`, owner.accessToken, {
      method: 'DELETE',
    });
    expect(ended.status).toBe(200);

    const after = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/call`, owner.accessToken);
    expect(after.data.joinUrl).toBeNull();
  } finally {
    await apiRequest(`/workspaces/${SLUG}/channels/${channelId}`, owner.accessToken, { method: 'DELETE' });
  }
});
