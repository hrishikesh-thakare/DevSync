import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Search', () => {
  let uniqueTitle: string;
  let uniqueText: string;

  test.beforeAll(async () => {
    uniqueTitle = `UnicornQuest ${Date.now()}`;
    uniqueText = `sphinxofblackquartz ${Date.now()}`;
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const created = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ title: uniqueTitle, issueType: 'task' }),
    });
    expect(created.status).toBe(201);
    const channels = await apiRequest(`/workspaces/${SLUG}/channels`, accessToken);
    const channel = (channels.data?.channels || [])[0];
    if (channel) {
      await apiRequest(`/workspaces/${SLUG}/channels/${channel.channelId}/messages`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ bodyText: uniqueText }),
      });
    }
  });

  test('search finds a task by its unique title', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/search?q=${encodeURIComponent(uniqueTitle.split(' ')[0])}&type=tasks`, accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(typeof data.taskCount).toBe('number');
    expect(data.tasks.some((t: any) => (t.title || t.taskTitle || '').includes(uniqueTitle.split(' ')[0]))).toBe(true);
  });

  test('search finds a message by its unique content', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/search?q=${uniqueText.slice(0, 15)}&type=messages`, accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.messages.some((m: any) => (m.bodyText || m.snippet || '').includes(uniqueText.slice(0, 15)))).toBe(true);
  });

  test('search response has structured shape with counts', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/search?q=test`, accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(Array.isArray(data.messages)).toBe(true);
    expect(typeof data.taskCount).toBe('number');
    expect(typeof data.messageCount).toBe('number');
    expect(typeof data.totalCount).toBe('number');
    expect(data.totalCount).toBe(data.taskCount + data.messageCount);
  });

  test('query shorter than 2 characters is rejected with 400', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/search?q=x`, accessToken);
    expect(status).toBe(400);
    expect(data.error).toContain('at least 2 characters');
  });

  test('outsider gets 403 on search', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/search?q=test`, accessToken);
    expect(status).toBe(403);
  });

  test('unauthenticated search is rejected with 401', async () => {
    const { status } = await apiRequest(`/workspaces/${SLUG}/search?q=test`, '');
    expect(status).toBe(401);
  });
});