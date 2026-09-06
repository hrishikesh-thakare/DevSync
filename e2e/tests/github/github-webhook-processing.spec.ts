import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const FIXTURES_DIR = path.resolve(import.meta.dirname, '../../fixtures/github-webhook-payloads');

// ─── Why this file exists ────────────────────────────────────────────────────
// The webhook handlers in github.controller.ts (push/pull_request/issues/
// create/workflow_run) had ZERO test coverage before this file — see the
// audit notes in docs/kanban.md's sibling discussion. github-webhook.spec.ts
// only exercises the HTTP edge (ping, missing connection, bad JSON); it never
// connects a real repo or sends a real signed payload, because CI runners
// have no public URL for GitHub's servers to actually deliver a webhook to.
//
// These tests were only possible because the whole pipeline was first
// verified by hand against a real throwaway GitHub repo through an ngrok
// tunnel: connect → push/PR/branch/issue → task status change, all for real.
// Every fixture below is the ACTUAL payload body GitHub sent during that run
// (captured from the tunnel), with only the task-key literal replaced by a
// `{{TASK_KEY}}` placeholder so it can target a fresh task each test run.
//
// Since a public tunnel isn't available in CI, these tests call
// `processGithubWebhookEvent` directly through a NODE_ENV-gated internal
// route (see backend/src/modules/internal-test) instead of POSTing to the
// real `/api/webhooks/github/:projectId` endpoint. That means HMAC signature
// verification and the job queue are NOT exercised here — those already have
// their own coverage (github-webhook.spec.ts, workers/queue.test.ts). What IS
// exercised, with real captured payload shapes, is the actual business logic:
// commit/PR/issue/branch linking and every auto status transition.

function randomSha(): string {
  return Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function loadFixture(name: string, taskKey: string): any {
  const raw = readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf8').replaceAll('{{TASK_KEY}}', taskKey);
  const payload = JSON.parse(raw);
  // github_commits has a GLOBAL unique constraint on (repo_full_name, commit_sha)
  // — not scoped per project — because that's how the real handler dedupes
  // retried deliveries. The push fixture's sha is a real, FIXED commit hash
  // captured once; reusing it across test runs/projects would collide with
  // that constraint (or worse, silently no-op via the handler's own "already
  // processed" check). Fake shas are fine — nothing here needs a real commit.
  if (Array.isArray(payload.commits)) {
    for (const commit of payload.commits) commit.id = randomSha();
  }
  return payload;
}

// Project keys are allowed to contain digits (projects.schemas.ts: max 10,
// no charset restriction), but the GitHub task-key regex used throughout
// github.controller.ts — `\b([A-Z]{1,10}-\d+)\b` — only matches a PURE
// uppercase-letter prefix before the dash. A key like `KB881234` (digits
// mixed into the prefix, the pattern other specs use for uniqueness) would
// make every taskKey in this suite invisible to that regex and silently
// break every assertion below. Keep this suite's keys letters-only.
function randomProjectKey(prefix = 'GH'): string {
  const letters = Array.from({ length: 6 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  return `${prefix}${letters}`;
}

async function createProject(token: string) {
  const key = randomProjectKey();
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects`, token, {
    method: 'POST',
    body: JSON.stringify({ name: `GitHub webhook processing ${key}`, key }),
  });
  expect(status, JSON.stringify(data)).toBe(201);
  return key as string;
}

async function createTask(token: string, key: string, title: string) {
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks`, token, {
    method: 'POST',
    body: JSON.stringify({ title, issueType: 'task', priority: 'medium' }),
  });
  expect(status, JSON.stringify(data)).toBe(201);
  return data.task as { taskId: string; taskKey: string; status: string };
}

async function runWebhookEvent(token: string, key: string, event: string, payload: unknown, defaultBranch = 'main') {
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/internal-test/github-webhook-event`, token, {
    method: 'POST',
    body: JSON.stringify({ event, payload, defaultBranch }),
  });
  expect(status, JSON.stringify(data)).toBe(200);
}

async function getTask(token: string, key: string, taskKey: string) {
  const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/tasks/${taskKey}`, token);
  expect(status, JSON.stringify(data)).toBe(200);
  return data.task;
}

test.describe('GitHub webhook processing (fixture-driven, from a real captured delivery)', () => {
  test('push with a closing keyword auto-closes the linked task', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Auto-close via commit');
      await runWebhookEvent(owner.accessToken, key, 'push', loadFixture('push', task.taskKey));

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.status).toBe('done');
      expect(updated.linkedCommitsCount).toBe(1);

      const commits = await apiRequest(`/workspaces/${SLUG}/projects/${key}/github/commits`, owner.accessToken);
      expect(commits.data.commits).toHaveLength(1);
      expect(commits.data.commits[0].taskKey).toBe(task.taskKey);
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('push referencing a todo task without a closing keyword bumps it to in_progress', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Auto in_progress via commit');
      const payload = loadFixture('push', task.taskKey);
      // The fixture ships with a closing keyword ("fixes ..."); swap it for a
      // plain reference so this exercises the "linked but not closed" branch.
      payload.commits[0].message = payload.commits[0].message.replace(/^fixes /, 'refs ');
      await runWebhookEvent(owner.accessToken, key, 'push', payload);

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.status).toBe('in_progress');
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('branch creation referencing a todo task bumps it to in_progress', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Auto in_progress via branch');
      await runWebhookEvent(owner.accessToken, key, 'create', loadFixture('create_branch', task.taskKey));

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.status).toBe('in_progress');

      const branches = await apiRequest(`/workspaces/${SLUG}/projects/${key}/github/branches`, owner.accessToken);
      expect(branches.data.branches.some((b: any) => b.taskKey === task.taskKey)).toBe(true);
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('PR opened against a todo task moves it to in_review', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Auto in_review via PR open');
      await runWebhookEvent(owner.accessToken, key, 'pull_request', loadFixture('pull_request_opened', task.taskKey));

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.status).toBe('in_review');

      const prs = await apiRequest(`/workspaces/${SLUG}/projects/${key}/github/pull-requests`, owner.accessToken);
      expect(prs.data.pullRequests[0]?.taskKey).toBe(task.taskKey);
      expect(prs.data.pullRequests[0]?.state).toBe('open');
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('PR merged into the default branch auto-closes the linked task', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Auto-close via PR merge');
      await runWebhookEvent(owner.accessToken, key, 'pull_request', loadFixture('pull_request_merged', task.taskKey), 'main');

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.status).toBe('done');

      const prs = await apiRequest(`/workspaces/${SLUG}/projects/${key}/github/pull-requests`, owner.accessToken);
      expect(prs.data.pullRequests[0]?.state).toBe('merged');
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('PR merged into a non-default branch does not auto-close the task', async () => {
    // Regression guard for the isDefaultBranch check in handlePullRequestEvent
    // — merging a feature branch into another feature branch must not
    // silently close tasks meant for the real release branch.
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Should stay open');
      const payload = loadFixture('pull_request_merged', task.taskKey);
      payload.pull_request.base.ref = 'develop';
      await runWebhookEvent(owner.accessToken, key, 'pull_request', payload, 'main');

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.status).toBe('todo');
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('an issue referencing a task links it without changing task status', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Linked issue test');
      await runWebhookEvent(owner.accessToken, key, 'issues', loadFixture('issues_opened', task.taskKey));

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.status).toBe('todo'); // issues never drive status changes

      const issues = await apiRequest(`/workspaces/${SLUG}/projects/${key}/github/issues`, owner.accessToken);
      expect(issues.data.issues[0]?.taskKey).toBe(task.taskKey);
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('a completed workflow_run is recorded as CI status', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      // This fixture carries no task-key reference — handleWorkflowRunEvent
      // stores CI status only, it never matches or moves a task.
      await runWebhookEvent(owner.accessToken, key, 'workflow_run', loadFixture('workflow_run_completed', 'UNUSED-1'));

      const ci = await apiRequest(`/workspaces/${SLUG}/projects/${key}/github/ci`, owner.accessToken);
      expect(ci.data.runs).toHaveLength(1);
      expect(ci.data.runs[0].status).toBe('completed');
      expect(ci.data.runs[0].conclusion).toBe('success');
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('redelivering the same commit does not double-count it (dedup)', async () => {
    // GitHub retries webhook deliveries that don't answer 2xx promptly; the
    // real handler dedupes on (repo_full_name, commit_sha) for exactly this.
    const owner = await apiLogin(TEST_USERS.owner.email);
    const key = await createProject(owner.accessToken);
    try {
      const task = await createTask(owner.accessToken, key, 'Dedup test');
      const payload = loadFixture('push', task.taskKey);
      await runWebhookEvent(owner.accessToken, key, 'push', payload);
      await runWebhookEvent(owner.accessToken, key, 'push', payload); // redeliver, same sha

      const commits = await apiRequest(`/workspaces/${SLUG}/projects/${key}/github/commits`, owner.accessToken);
      expect(commits.data.commits).toHaveLength(1);

      const updated = await getTask(owner.accessToken, key, task.taskKey);
      expect(updated.linkedCommitsCount).toBe(1);
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });

  test('a non-project_admin cannot invoke the internal test endpoint', async () => {
    const owner = await apiLogin(TEST_USERS.owner.email);
    const developer = await apiLogin(TEST_USERS.developer.email);
    const key = await createProject(owner.accessToken);
    try {
      const { status } = await apiRequest(`/workspaces/${SLUG}/projects/${key}/internal-test/github-webhook-event`, developer.accessToken, {
        method: 'POST',
        body: JSON.stringify({ event: 'push', payload: {} }),
      });
      expect(status).toBe(403);
    } finally {
      await apiRequest(`/workspaces/${SLUG}/projects/${key}`, owner.accessToken, { method: 'DELETE' });
    }
  });
});
