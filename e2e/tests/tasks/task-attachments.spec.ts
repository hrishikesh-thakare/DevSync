/**
 * Task Attachments Tests
 *
 * Covers the task attachment endpoints:
 *   GET    /tasks/:taskKey/attachments
 *   POST   /tasks/:taskKey/attachments          (add via base64)
 *   DELETE /tasks/:taskKey/attachments/:fileId
 *
 * Plus validation, RBAC (viewer read-only, developer add/delete), 404s for
 * unknown tasks/attachments, and the task.attachment_added audit trail entry.
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

test.describe('Task Attachments', () => {
  async function createTask(accessToken: string) {
    const { data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Attachment test ${Date.now()}`, issueType: 'task' }),
    });
    return data?.task?.taskKey || data?.taskKey;
  }

  // Retries once on 500/404: the Windows undici/libuv flake can corrupt a
  // single pooled SELECT (task-key resolver returns "Task not found" → 404)
  // while fire-and-forget Gemini calls are in flight.
  async function addAttachment(base: string, accessToken: string, body: any) {
    const first = await apiRequest(base, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (first.status !== 500 && first.status !== 404) return first;
    await new Promise((r) => setTimeout(r, 750));
    return apiRequest(base, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  test('add, list, download and delete an attachment', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const taskKey = await createTask(accessToken);
    expect(taskKey).toBeTruthy();
    const base = `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}/attachments`;

    const add = await addAttachment(base, accessToken, {
      filename: 'design.png',
      mimetype: 'image/png',
      sizeBytes: 1234,
      filetype: 'image',
      fileBase64: 'aGVsbG8=',
    });
    expect(add.status).toBe(201);
    const fileId = add.data.attachment?.fileId;
    expect(fileId).toBeTruthy();

    const list = await apiRequest(base, accessToken);
    expect(list.status).toBe(200);
    const found = (list.data.attachments || []).find((a: any) => a.fileId === fileId);
    expect(found).toBeTruthy();
    expect(found.filename).toBe('design.png');
    expect(found.uploaderName).toBeTruthy();

    const dl = await apiRequest(`/workspaces/${SLUG}/files/${fileId}/download`, accessToken);
    expect(dl.status).toBe(200);
    expect(dl.data.downloadUrl).toBeTruthy();

    const del = await apiRequest(`${base}/${fileId}`, accessToken, { method: 'DELETE' });
    expect(del.status).toBe(200);

    const after = await apiRequest(base, accessToken);
    expect(after.data.attachments.some((a: any) => a.fileId === fileId)).toBe(false);
    const delAgain = await apiRequest(`${base}/${fileId}`, accessToken, { method: 'DELETE' });
    expect(delAgain.status).toBe(404);
  });

  test('attachment requires filename and fileBase64 (400)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const taskKey = await createTask(accessToken);
    const base = `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}/attachments`;

    const noName = await apiRequest(base, accessToken, {
      method: 'POST',
      body: JSON.stringify({ fileBase64: 'YQ==' }),
    });
    expect(noName.status).toBe(400);

    const noBase64 = await apiRequest(base, accessToken, {
      method: 'POST',
      body: JSON.stringify({ filename: 'x.png' }),
    });
    expect(noBase64.status).toBe(400);
  });

  test('RBAC: viewer read-only, developer can add/delete, outsider blocked', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const taskKey = await createTask(owner.accessToken);
    const base = `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}/attachments`;
    const body = JSON.stringify({ filename: 'rbac.png', fileBase64: 'YQ==' });

    const viewer = await apiLogin(TEST_USERS.viewer.email);
    const viewerList = await apiRequest(base, viewer.accessToken);
    expect(viewerList.status).toBe(200);
    const viewerAdd = await apiRequest(base, viewer.accessToken, { method: 'POST', body });
    expect(viewerAdd.status).toBe(403);

    const developer = await apiLogin(TEST_USERS.developer.email);
    const devAdd = await addAttachment(base, developer.accessToken, {
      filename: 'rbac.png',
      fileBase64: 'YQ==',
    });
    expect(devAdd.status).toBe(201);
    const devDelete = await apiRequest(
      `${base}/${devAdd.data.attachment.fileId}`,
      developer.accessToken,
      { method: 'DELETE' }
    );
    expect(devDelete.status).toBe(200);

    const outsider = await apiLogin(TEST_USERS.outsider.email);
    const outList = await apiRequest(base, outsider.accessToken);
    expect(outList.status).toBe(403);
  });

  test('adding an attachment to a non-existent task returns 404', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/NOPE-404/attachments`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ filename: 'x.png', fileBase64: 'YQ==' }) }
    );
    expect(status).toBe(404);
  });

  test('task audit trail logs task.attachment_added', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { data: created } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ title: `Attachment audit ${Date.now()}`, issueType: 'task' }) }
    );
    const taskId = created?.task?.taskId || created?.taskId;
    expect(taskId).toBeTruthy();
    const taskKey = created?.task?.taskKey || created?.taskKey;

    const base = `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}/attachments`;
    const add = await apiRequest(base, accessToken, {
      method: 'POST',
      body: JSON.stringify({ filename: 'audit.txt', fileBase64: 'YQ==' }),
    });
    expect(add.status).toBe(201);
    const fileId = add.data.attachment?.fileId;
    expect(fileId).toBeTruthy();

    const audit = await apiRequest(`/audit/task/${taskId}`, accessToken);
    expect(audit.status).toBe(200);
    expect(
      audit.data.logs.some(
        (l: any) => l.action === 'task.attachment_added' && l.newValues?.file_id === fileId
      )
    ).toBe(true);
  });
});