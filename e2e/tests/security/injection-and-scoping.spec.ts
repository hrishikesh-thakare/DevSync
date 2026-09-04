import { test, expect } from '@playwright/test';
import { apiLogin, apiRequest } from '../../helpers/api-helpers';
import { TEST_USERS, TEST_WORKSPACE, TEST_PROJECT } from '../../helpers/constants';

/**
 * Regression tests for the Phase 1 security fixes.
 *
 * Each block names the hole it closes. They are written against the API rather
 * than the UI on purpose: none of these were reachable through the UI in the
 * first place — they were reachable by anyone willing to send the request
 * themselves, which is exactly who a test like this stands in for.
 */

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;
const ts = Date.now();

let ownerToken: string;
let developerToken: string;
let channelA: string;
let channelB: string;

test.beforeAll(async () => {
  ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
  developerToken = (await apiLogin(TEST_USERS.developer.email)).accessToken;

  // Two channels are needed to prove a thread reply cannot cross between them.
  // Reuse whatever the seed already created rather than making more: channel
  // names are unique per workspace, and every parallel worker runs this hook,
  // so creating them here raced into 409s.
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/channels`, ownerToken);
  expect(status, 'list channels').toBe(200);

  const usable = (data.channels ?? []).filter(
    (c: { type: string; isArchived?: boolean }) => c.type === 'public' && !c.isArchived,
  );
  expect(usable.length, 'seed should provide at least two public channels').toBeGreaterThanOrEqual(2);

  channelA = usable[0].channelId;
  channelB = usable[1].channelId;
});

// ─── isSystem is server-authored ─────────────────────────────────────────────
test.describe('Messages — isSystem is not client input', () => {
  // The schema is .strict(), so an unknown key is a 400 rather than a silent
  // drop. Before the fix `isSystem` was accepted from the body and used to skip
  // the announcement-channel admin check entirely.
  for (const [label, body] of [
    ['isSystem', { bodyText: 'pretending to be the system', isSystem: true }],
    ['systemType', { bodyText: 'hello', systemType: 'sprint_started' }],
  ] as const) {
    test(`rejects a client-supplied ${label}`, async () => {
      const { status } = await apiRequest(
        `/workspaces/${SLUG}/channels/${channelA}/messages`,
        developerToken,
        { method: 'POST', body: JSON.stringify(body) },
      );
      expect(status).toBe(400);
    });
  }
});

// ─── thread replies cannot cross channels ────────────────────────────────────
test.describe('Messages — thread parent must be in the same channel', () => {
  test('rejects a threadId belonging to another channel', async () => {
    const root = await apiRequest(`/workspaces/${SLUG}/channels/${channelA}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `thread root ${ts}` }),
    });
    expect(root.status).toBe(201);
    const foreignThreadId = root.data.data.messageId;
    expect(foreignThreadId).toBeTruthy();

    // Reply in channel B, pointing at channel A's message. Unscoped, this
    // attached the reply to that thread and bumped its reply_count — visible to
    // readers of a channel the sender may have no access to at all.
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channelB}/messages`,
      ownerToken,
      { method: 'POST', body: JSON.stringify({ bodyText: 'injected reply', threadId: foreignThreadId }) },
    );

    expect(status).toBe(404);
  });

  test('accepts a threadId in the same channel', async () => {
    const root = await apiRequest(`/workspaces/${SLUG}/channels/${channelA}/messages`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ bodyText: `local root ${ts}` }),
    });
    expect(root.status).toBe(201);

    const { status } = await apiRequest(
      `/workspaces/${SLUG}/channels/${channelA}/messages`,
      ownerToken,
      {
        method: 'POST',
        body: JSON.stringify({ bodyText: 'local reply', threadId: root.data.data.messageId }),
      },
    );
    expect(status).toBe(201);
  });
});

// ─── GitHub path params are numeric ──────────────────────────────────────────
test.describe('GitHub — numeric path params are validated', () => {
  const base = `/workspaces/${SLUG}/projects/${KEY}/github`;

  // A traversal in one of these used to reach a different api.github.com
  // endpoint entirely, executed with the connecting user's stored OAuth token
  // rather than the caller's.
  for (const value of ['..%2F..%2Fuser%2Frepos', 'abc', '1;2', '-1']) {
    test(`rejects runId "${value}"`, async () => {
      const { status } = await apiRequest(`${base}/ci/${value}/rerun`, ownerToken, {
        method: 'POST',
      });
      expect(status).toBe(400);
    });
  }

  test('rejects a non-numeric issueNumber', async () => {
    const { status } = await apiRequest(`${base}/issues/not-a-number/comments`, ownerToken);
    expect(status).toBe(400);
  });

  test('rejects a non-numeric prNumber', async () => {
    const { status } = await apiRequest(`${base}/pull-requests/x/comments`, ownerToken);
    expect(status).toBe(400);
  });

  test('rejects a repo owner containing a path separator', async () => {
    const { status } = await apiRequest(`${base}/connect`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ repo_owner: '../../user', repo_name: 'repo' }),
    });
    expect(status).toBe(400);
  });
});

// ─── unfurl cannot reach the internal network ────────────────────────────────
test.describe('Unfurl — SSRF protection', () => {
  const base = `/workspaces/${SLUG}/unfurl`;

  for (const url of [
    'http://169.254.169.254/latest/meta-data/', // cloud metadata
    'http://127.0.0.1:3001/api/health', // loopback by address
    'http://localhost:5432', // loopback by name
    'http://10.0.0.1/', // RFC1918
    'http://192.168.1.1/', // RFC1918
    'http://[::1]/', // IPv6 loopback
    'http://0.0.0.0/', // "this network"
  ]) {
    test(`refuses ${url}`, async () => {
      const { status, data } = await apiRequest(
        `${base}?url=${encodeURIComponent(url)}`,
        ownerToken,
      );
      expect(status).toBe(400);
      expect(String(data?.error ?? '')).toMatch(/non-public|resolve|protocol|Invalid URL/i);
    });
  }

  test('refuses a non-http scheme', async () => {
    const { status } = await apiRequest(
      `${base}?url=${encodeURIComponent('file:///etc/passwd')}`,
      ownerToken,
    );
    expect(status).toBe(400);
  });
});

// ─── uploads are validated at the choke point ────────────────────────────────
test.describe('Files — upload validation', () => {
  const base = `/workspaces/${SLUG}/files/upload`;
  const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

  test('rejects a disallowed mimetype', async () => {
    const { status, data } = await apiRequest(base, ownerToken, {
      method: 'POST',
      body: JSON.stringify({
        filename: 'payload.html',
        mimetype: 'text/html',
        fileBase64: b64('<script>alert(1)</script>'),
      }),
    });
    expect(status).toBe(400);
    expect(String(data?.error ?? '')).toMatch(/not allowed/i);
  });

  test('rejects SVG, which is an image to a user and a script host to a browser', async () => {
    const { status } = await apiRequest(base, ownerToken, {
      method: 'POST',
      body: JSON.stringify({
        filename: 'x.svg',
        mimetype: 'image/svg+xml',
        fileBase64: b64('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      }),
    });
    expect(status).toBe(400);
  });

  test('rejects an unknown key', async () => {
    const { status } = await apiRequest(base, ownerToken, {
      method: 'POST',
      body: JSON.stringify({
        filename: 'a.txt',
        mimetype: 'text/plain',
        fileBase64: b64('hi'),
        storagePath: 'workspaces/../../etc/passwd',
      }),
    });
    expect(status).toBe(400);
  });

  test('accepts an allowed type and stores the measured size', async () => {
    const content = 'hello devsync';
    const { status, data } = await apiRequest(base, ownerToken, {
      method: 'POST',
      body: JSON.stringify({
        filename: 'note.txt',
        mimetype: 'text/plain',
        // A deliberately wrong client assertion — the server should ignore it
        // and record the real decoded length instead.
        sizeBytes: 999999,
        fileBase64: b64(content),
      }),
    });
    expect(status).toBe(200);
    expect(data.fileRecord.sizeBytes).toBe(content.length);
  });
});
