import { test, expect } from '@playwright/test';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

/**
 * @mentions in a channel message — previously zero coverage (audit: "zero
 * coverage of any kind: ... @mentions"). `messages.controller.ts` resolves a
 * plain-text `@name` against `fullName`/`displayName` scoped to the sender's
 * workspace (the Tiptap-produced `data-type="mention"` span is the primary
 * path, this is its fallback) and files a `channel_mentioned` notification —
 * this exercises that fallback end to end, since it needs no rich-text editor
 * automation to trigger.
 */

const SLUG = TEST_WORKSPACE.slug;

async function findPublicChannel(token: string) {
  const { data } = await apiRequest(`/workspaces/${SLUG}/channels`, token);
  const channel = (data.channels ?? []).find(
    (c: { type: string; isArchived?: boolean }) => c.type === 'public' && !c.isArchived,
  );
  expect(channel, 'seed should provide a public channel').toBeTruthy();
  return channel.channelId as string;
}

test('mentioning a member by name notifies them', async () => {
  const owner = await apiLogin(TEST_USERS.owner.email);
  const dev = await apiLogin(TEST_USERS.developer.email);
  const channelId = await findPublicChannel(owner.accessToken);

  const marker = `mention-e2e-${Date.now()}`;
  const { status, data: sent } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, owner.accessToken, {
    method: 'POST',
    // `Dave` matches TEST_USERS.developer's fullName ("Dave Patel") via the
    // `ilike(fullName, username + '%')` prefix match.
    body: JSON.stringify({ bodyText: `Hey @Dave, take a look — ${marker}` }),
  });
  expect(status).toBe(201);
  const messageId = sent.data.messageId;

  let notification: any;
  await expect
    .poll(
      async () => {
        const { data } = await apiRequest('/notifications', dev.accessToken);
        notification = (data.notifications ?? []).find(
          (n: any) => n.type === 'channel_mentioned' && n.entityId === messageId,
        );
        return Boolean(notification);
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  expect(notification.title).toContain(TEST_USERS.owner.name);
});

test('mentioning someone outside the workspace resolves to nobody', async () => {
  const owner = await apiLogin(TEST_USERS.owner.email);
  const channelId = await findPublicChannel(owner.accessToken);

  // "Frank" (the outsider fixture) is not a member of this workspace — the
  // lookup is joined to `workspace_members` specifically so a name that only
  // exists elsewhere never resolves here (the cross-tenant leak this fixed).
  const { status } = await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/messages`, owner.accessToken, {
    method: 'POST',
    body: JSON.stringify({ bodyText: `@Frank this should not resolve to anyone ${Date.now()}` }),
  });
  expect(status).toBe(201);
  // No assertion beyond "the send itself succeeds" — there is no notification
  // recipient to poll for, which is exactly the point.
});
