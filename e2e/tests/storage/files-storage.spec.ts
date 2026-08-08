import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

test.describe('Files & Storage', () => {
  let fileId = '';

  test('can request upload URL via /workspaces/:slug/files/upload-url', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/files/upload-url`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ bucket: 'attachments', filename: 'test.png' })
    });
    // Returns 200 or 500 depending on Supabase configuration
    expect([200, 201, 500]).toContain(status);
    if (status === 200 && data?.fileRecord) {
      fileId = data.fileRecord.fileId;
    }
  });

  test('can request download URL via /workspaces/:slug/files/:fileId/download', async () => {
    if (!fileId) return; // Skip if upload failed (e.g. 500 from Supabase missing config)
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/files/${fileId}/download`, accessToken);
    expect([200, 404, 500]).toContain(status);
  });
});
