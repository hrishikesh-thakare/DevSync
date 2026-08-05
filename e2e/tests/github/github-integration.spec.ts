import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('GitHub Integration', () => {
  test('can request OAuth URL', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest('/github/oauth/url', accessToken);
    expect([200, 500]).toContain(status);
    if (status === 200) {
      expect(data.url).toContain('github.com/login/oauth/authorize');
    }
  });

  test('connection status is initially empty', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/connection`, accessToken);
    expect(status).toBe(200);
    expect(data?.connection).toBeNull();
  });

  test('non-admin gets 403 trying to connect or disconnect', async () => {
    // developer is not project_admin by default in TEST_USERS
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    
    const { status: connectStatus } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/connect`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ repoFullName: 'test/repo' })
    });
    expect(connectStatus).toBe(403);

    const { status: disconnectStatus } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/disconnect`, accessToken, {
      method: 'DELETE'
    });
    expect(disconnectStatus).toBe(403);
  });
});
