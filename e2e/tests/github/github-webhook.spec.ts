import { test, expect } from '../../fixtures/test-fixtures.js';
import { API_URL, TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';
import { randomUUID } from 'crypto';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

async function sendWebhook(projectId: string, event: string | undefined, body: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (event !== undefined) headers['X-GitHub-Event'] = event;
  return fetch(`${API_URL}/webhooks/github/${projectId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test.describe('GitHub Webhook', () => {
  let projectId: string;

  test.beforeAll(async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}`, accessToken);
    projectId = data?.project?.projectId;
    expect(projectId).toBeTruthy();
  });

  test('ping events return pong without auth or signature', async () => {
    const res = await sendWebhook(randomUUID(), 'ping', { zen: 'test' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('pong');
  });

  test('project with no GitHub connection returns 404', async () => {
    const res = await sendWebhook(projectId, 'push', { ref: 'refs/heads/main' });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no webhook configured');
  });

  test('missing x-github-event header falls through to connection lookup (404)', async () => {
    const res = await sendWebhook(projectId, undefined, { zen: 'test' });
    expect(res.status).toBe(404);
  });

  test('unknown project id returns 404', async () => {
    const res = await sendWebhook(randomUUID(), 'push', { ref: 'refs/heads/main' });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no webhook configured');
  });

  test('malformed JSON without signature is rejected before parsing (404, not 500)', async () => {
    // No connection exists, so the signature check never runs — but the raw
    // body middleware must not crash on invalid JSON for this route.
    const res = await fetch(`${API_URL}/webhooks/github/${randomUUID()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GitHub-Event': 'push' },
      body: '{ not valid json',
    });
    expect(res.status).toBe(404);
  });
});