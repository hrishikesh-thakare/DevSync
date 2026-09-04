import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const CONTENT = `files-e2e-${Date.now()}`;
const FILE_BASE64 = Buffer.from(CONTENT).toString('base64');

test.describe('Files & Storage', () => {
  // Upload → download → raw sequence shares fileId — must not interleave.
  test.describe.configure({ mode: 'serial' });
  let fileId = '';
  let rawUrl = '';

  test('upload a file (base64) and get a fileRecord', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/files/upload`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ filename: 'e2e-test.txt', fileBase64: FILE_BASE64, mimetype: 'text/plain' }),
    });
    expect(status).toBe(200);
    expect(data.fileRecord).toBeTruthy();
    fileId = data.fileRecord.fileId;
    expect(fileId).toBeTruthy();
  });

  test('request a download URL for the uploaded file', async () => {
    expect(fileId).toBeTruthy();
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/files/${fileId}/download`, accessToken);
    expect(status).toBe(200);
    expect(data.downloadUrl).toBeTruthy();
    rawUrl = data.downloadUrl;
  });

  test('raw endpoint serves the file content', async () => {
    expect(rawUrl).toBeTruthy();
    const res = await fetch(rawUrl);
    if (res.status !== 200) {
      const body = await res.text();
      throw new Error(`Expected 200 but got ${res.status}: ${body}\nrawUrl: ${rawUrl}`);
    }
    expect(await res.text()).toBe(CONTENT);
  });

  test('raw endpoint rejects requests without a token', async () => {
    expect(fileId).toBeTruthy();
    const res = await fetch(`http://localhost:3001/api/workspaces/${SLUG}/files/${fileId}/raw`);
    expect(res.status).toBe(401);
  });

  test('upload validates filename and fileBase64', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const noName = await apiRequest(`/workspaces/${SLUG}/files/upload`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ fileBase64: FILE_BASE64 }),
    });
    expect(noName.status).toBe(400);
    const noBase64 = await apiRequest(`/workspaces/${SLUG}/files/upload`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ filename: 'x.txt' }),
    });
    expect(noBase64.status).toBe(400);
  });

  test('download of a non-existent file returns 404', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/files/${'00000000-0000-4000-8000-000000000000'}/download`,
      accessToken
    );
    expect(status).toBe(404);
    expect(data.error).toContain('not found');
  });

  test('outsider cannot upload or download', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const upload = await apiRequest(`/workspaces/${SLUG}/files/upload`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ filename: 'x.txt', fileBase64: FILE_BASE64 }),
    });
    expect(upload.status).toBe(403);
    const download = await apiRequest(`/workspaces/${SLUG}/files/${fileId}/download`, accessToken);
    expect(download.status).toBe(403);
  });

  test('upload and download require authentication', async () => {
    const upload = await apiRequest(`/workspaces/${SLUG}/files/upload`, '', {
      method: 'POST',
      body: JSON.stringify({ filename: 'x.txt', fileBase64: FILE_BASE64 }),
    });
    expect(upload.status).toBe(401);
    const download = await apiRequest(`/workspaces/${SLUG}/files/${fileId}/download`, '');
    expect(download.status).toBe(401);
  });

});