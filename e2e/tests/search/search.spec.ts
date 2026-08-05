import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

test.describe('Search', () => {
  test('search tasks by title', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/search?q=test&type=task`, accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data?.tasks || data?.results || data)).toBe(true);
  });

  test('search messages by content', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/search?q=test&type=message`, accessToken);
    expect(status).toBe(200);
    expect(Array.isArray(data?.messages || data?.results || data)).toBe(true);
  });

  test('outsider gets 403 on search', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/search?q=test`, accessToken);
    expect(status).toBe(403);
  });
});
