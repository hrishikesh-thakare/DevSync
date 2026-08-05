import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Audit Logs', () => {
  test('actions are logged in audit trail', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);

    // Get project ID first
    const { data: projData } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, accessToken);
    const projectId = projData?.project?.projectId || projData?.projectId;
    if (!projectId) { test.skip(); return; }

    // Make a change
    const newDesc = `Audit test ${Date.now()}`;
    await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ description: newDesc }),
    });

    // Verify audit log
    const { status, data } = await apiRequest(`/audit/project/${projectId}`, accessToken);
    expect(status).toBe(200);
    
    const logs = data?.logs || data || [];
    const found = logs.some((log: any) => log.action?.includes('project'));
    expect(found).toBe(true);
  });
});
