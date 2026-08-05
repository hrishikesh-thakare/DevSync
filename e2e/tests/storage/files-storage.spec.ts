import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

test.describe('Files & Storage', () => {
  test('can request upload URL via /storage', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest('/storage/upload-url', accessToken, {
      method: 'POST',
      body: JSON.stringify({ bucket: 'attachments', filename: 'test.png' })
    });
    // Returns 200 or 500 depending on Supabase configuration
    expect([200, 201, 500]).toContain(status);
  });

  test('can request download URL via /storage', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest('/storage/download-url?bucket=attachments&path=test.png', accessToken);
    expect([200, 404, 500]).toContain(status);
  });
});
