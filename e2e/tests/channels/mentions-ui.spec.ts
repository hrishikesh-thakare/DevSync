/**
 * @mentions — the composer's `@` autocomplete popup, end to end.
 *
 * `mentions.spec.ts` covers the plain-text `@name` fallback purely at the API
 * level (no rich-text editor involved). This file covers the actual feature
 * built on top of it: the Tiptap Mention extension's suggestion popup, task
 * mentions, click-through to the task page, and the popup's own UI
 * correctness (scrolling, self-exclusion) — none of which had any coverage
 * before this, and all of which broke at least once during development
 * (a `ScrollArea` regression that silently stopped the list from clipping,
 * and a positioning rewrite that put the popup behind the composer).
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, BASE_URL } from '../../helpers/constants.js';
import { apiLogin, apiRequest, getAuthToken } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;
const ts = Date.now();

let ownerToken: string;
let devToken: string;
let devUserId: string;
let channelId: string;
let taskKey: string;

test.beforeAll(async () => {
  const owner = await apiLogin(TEST_USERS.owner.email);
  const dev = await apiLogin(TEST_USERS.developer.email);
  ownerToken = owner.accessToken;
  devToken = dev.accessToken;
  devUserId = dev.user.userId;

  // A project-linked channel: task mentions only search a project's tasks
  // when the channel the message is posted in is linked to one.
  const { data: projectData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, ownerToken);
  const projectId = projectData.project.projectId;

  const { data: channelData } = await apiRequest(`/workspaces/${SLUG}/channels`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({ name: `mentions-ui-${ts}`, type: 'public', projectId }),
  });
  channelId = channelData.channel.channelId;

  // The mention picker's user results come from the *channel's* member list,
  // not the whole workspace — dev has to actually join.
  await apiRequest(`/workspaces/${SLUG}/channels/${channelId}/join`, devToken, { method: 'POST' });

  // A task with a known assignee, so the task-mention notification has a
  // deterministic recipient to poll for instead of whatever the seed happens
  // to contain.
  const { data: taskData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({
      title: `Mention target ${ts}`,
      issueType: 'task',
      priority: 'medium',
      assigneeId: devUserId,
    }),
  });
  taskKey = taskData.task?.taskKey || taskData.taskKey;
});

test.describe('Mention popup — people', () => {
  test('picking a person from the popup inserts a real mention and notifies them', async ({ ownerPage }) => {
    await ownerPage.goto(`${BASE_URL}/w/${SLUG}/channels/${channelId}`);
    const editor = ownerPage.locator('[contenteditable="true"]').first();
    await editor.click();

    const marker = `mention-ui-${Date.now()}`;
    await editor.type('@Dave', { delay: 40 });

    const popup = ownerPage.getByTestId('mention-list');
    await expect(popup).toBeVisible();
    await popup.getByText(TEST_USERS.developer.name, { exact: true }).click();
    await editor.type(` ${marker}`, { delay: 20 });
    await ownerPage.keyboard.press('Enter');

    // The sent message actually contains the real mention node, not a plain
    // "@Dave" the backend's fuzzy ilike fallback would have to guess at.
    // .last(): the optimistic send and the server-confirmed message both
    // match hasText briefly, same as the task-mention tests below.
    const row = ownerPage.locator('.rich-message-content', { hasText: marker }).last();
    await expect(row.locator('span[data-type="mention"]')).toHaveText(`@${TEST_USERS.developer.name}`);

    await expect
      .poll(
        async () => {
          const { data } = await apiRequest('/notifications', devToken);
          return (data.notifications ?? []).some(
            (n: any) => n.type === 'channel_mentioned' && n.body?.includes(marker),
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('you never appear in your own mention list', async ({ developerPage }) => {
    await developerPage.goto(`${BASE_URL}/w/${SLUG}/channels/${channelId}`);
    const editor = developerPage.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.type('@', { delay: 40 });

    const popup = developerPage.getByTestId('mention-list');
    await expect(popup).toBeVisible();
    await expect(popup.getByText(TEST_USERS.developer.name, { exact: true })).toHaveCount(0);
  });

  test('the popup scrolls instead of silently failing to clip a long list', async ({ ownerPage }) => {
    // Regression test: a `ScrollArea` wrapper around `CommandList` measures
    // its `Viewport` as `height: 100%` against a `max-h-*` (non-definite)
    // parent, which never resolves — the list renders at full, unclipped
    // height instead of scrolling. Broke live twice during development.
    await ownerPage.goto(`${BASE_URL}/w/${SLUG}/channels/${channelId}`);
    const editor = ownerPage.locator('[contenteditable="true"]').first();
    await editor.click();
    // A single common letter is broad enough to pull in enough of this
    // heavily-seeded workspace's members and tasks to overflow the popup.
    await editor.type('@e', { delay: 40 });

    const popup = ownerPage.getByTestId('mention-list');
    await expect(popup).toBeVisible();
    const list = popup.locator('[data-slot="command-list"]');

    const metrics = await list.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(metrics.overflowY).toBe('auto');
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  });
});

test.describe('Mention popup — tasks', () => {
  test('picking a task inserts plain text and notifies its assignee', async ({ ownerPage }) => {
    await ownerPage.goto(`${BASE_URL}/w/${SLUG}/channels/${channelId}`);
    const editor = ownerPage.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.type(`@${taskKey}`, { delay: 40 });

    const popup = ownerPage.getByTestId('mention-list');
    await expect(popup).toBeVisible();
    await popup.getByText(taskKey, { exact: false }).first().click();
    await ownerPage.keyboard.press('Enter');

    // Picking a task inserts *plain* `@KEY` text, not a node — this is what
    // keeps it understood by the backend's existing task-mention regex
    // without any backend change.
    const row = ownerPage.locator('.rich-message-content', { hasText: taskKey }).last();
    await expect(row).toBeVisible();

    await expect
      .poll(
        async () => {
          const { data } = await apiRequest('/notifications', devToken);
          return (data.notifications ?? []).some(
            (n: any) => n.type === 'task_mentioned' && n.title?.includes(taskKey),
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('a task mention renders as a link to the task page and is stylistically distinct from a user mention', async ({ ownerPage }) => {
    await ownerPage.goto(`${BASE_URL}/w/${SLUG}/channels/${channelId}`);
    const editor = ownerPage.locator('[contenteditable="true"]').first();
    await editor.click();
    const marker = `click-through-${Date.now()}`;
    await editor.type(`${marker} @${taskKey}`, { delay: 30 });
    const popup = ownerPage.getByTestId('mention-list');
    await expect(popup).toBeVisible();
    await ownerPage.keyboard.press('Escape');
    await ownerPage.keyboard.press('Enter');

    const row = ownerPage.locator('.rich-message-content', { hasText: marker }).last();
    const link = row.locator('a[data-type="task-mention"]');
    await expect(link).toHaveAttribute('href', new RegExp(`/projects/${KEY}/tasks/${taskKey}$`));

    // Distinct from a user mention's bold filled-pill treatment — monospace
    // and underlined is the "this is a link, not a name" signal.
    await expect(link).toHaveCSS('font-family', /mono/);

    await link.click();
    await expect(ownerPage).toHaveURL(new RegExp(`/w/${SLUG}/projects/${KEY}/tasks/${taskKey}$`));
  });
});
