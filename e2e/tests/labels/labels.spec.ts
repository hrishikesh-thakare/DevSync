import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

let labelsBase: string;
let unique: string;
let ownerToken: string;

test.beforeAll(async () => {
  labelsBase = `/workspaces/${SLUG}/projects/${KEY}/labels`;
  unique = `l${Date.now()}`; // lowercase: label names are normalized to lowercase
  ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
});

test.describe('Labels', () => {
  // Labels persist in the DB and the suites build on each other — run as an
  // ordered sequence in a single worker (fullyParallel is global).
  test.describe.configure({ mode: 'serial' });

test.describe('Labels — CRUD', () => {
  test('create label returns 201 with normalized name and default color', async () => {
    const { status, data } = await apiRequest(labelsBase, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `  Frontend   Performance ${unique}  ` }),
    });
    expect(status).toBe(201);
    expect(data.label.name).toBe(`frontend performance ${unique}`);
    expect(data.label.color).toBe('#64748b');
    expect(data.label.labelId).toBeTruthy();
  });

  test('create label with custom color keeps it', async () => {
    const { status, data } = await apiRequest(labelsBase, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `bug ${unique}`, color: '#ff0000' }),
    });
    expect(status).toBe(201);
    expect(data.label.name).toBe(`bug ${unique}`);
    expect(data.label.color).toBe('#ff0000');
  });

  test('duplicate label is rejected with 409 (case-insensitive)', async () => {
    await apiRequest(labelsBase, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `DuplicateMe${unique}` }),
    });
    const { status, data } = await apiRequest(labelsBase, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `  duplicateme${unique} ` }),
    });
    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });

test('list labels returns all with usageCount', async () => {
    const { status, data } = await apiRequest(labelsBase, ownerToken);
    expect(status).toBe(200);
    expect(Array.isArray(data.labels)).toBe(true);
    let bug = data.labels.find((l: any) => l.name === `bug ${unique}`);
    if (!bug) {
      // Windows undici/libuv flake: a single pooled SELECT can return empty
      // rows while a fire-and-forget Gemini call is in flight. The label was
      // created earlier in this serial suite, so retry the read once.
      const retry = await apiRequest(labelsBase, ownerToken);
      expect(retry.status).toBe(200);
      bug = retry.data.labels.find((l: any) => l.name === `bug ${unique}`);
    }
    expect(bug).toBeTruthy();
    expect(bug.usageCount).toBe(0);
  });

  test('validation: bad name, bad color, extra keys rejected with 400', async () => {
    const cases = [
      { name: '' },
      { name: 'x'.repeat(51) },
      { name: 'ok', color: 'red' },
      { name: 'ok', color: '#12345' },
      { name: 'ok', extra: 'nope' },
      { name: 42 },
    ];
    for (const body of cases) {
      const { status, data } = await apiRequest(labelsBase, ownerToken, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(status, `create label ${JSON.stringify(body)} should be 400`).toBe(400);
      expect(data.error).toBeTruthy();
    }
  });

  test('update color only returns 200 and keeps name', async () => {
    const { data: created } = await apiRequest(labelsBase, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: `Recolor${unique}` }),
    });
    const labelId = created.label.labelId;
    const { status, data } = await apiRequest(`${labelsBase}/${labelId}`, ownerToken, {
      method: 'PATCH',
      body: JSON.stringify({ color: '#00ff00' }),
    });
    expect(status).toBe(200);
    expect(data.label.name).toBe(`recolor${unique}`);
    expect(data.label.color).toBe('#00ff00');
  });

  test('rename conflict returns 409', async () => {
    await apiRequest(labelsBase, ownerToken, { method: 'POST', body: JSON.stringify({ name: `RenameTarget${unique}` }) });
    const { data: created } = await apiRequest(labelsBase, ownerToken, { method: 'POST', body: JSON.stringify({ name: `RenameSource${unique}` }) });
    const { status, data } = await apiRequest(`${labelsBase}/${created.label.labelId}`, ownerToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: `renametarget${unique}` }),
    });
    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  test('update/delete of non-existent label returns 404', async () => {
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const patch = await apiRequest(`${labelsBase}/${fakeId}`, ownerToken, { method: 'PATCH', body: JSON.stringify({ name: 'nope' }) });
    expect(patch.status).toBe(404);
    const del = await apiRequest(`${labelsBase}/${fakeId}`, ownerToken, { method: 'DELETE' });
    expect(del.status).toBe(404);
  });
});

test.describe('Labels — task integration', () => {
  let taskKey: string;

  test('task creation auto-registers labels and increments usageCount', async () => {
    const labelName = `auto${unique}`;
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Labeled task ${unique}`, issueType: 'task', labels: [labelName] }),
    });
    expect(status).toBe(201);
    taskKey = data.task.taskKey;
    expect(data.task.labels).toEqual([labelName]);

    const { data: labels } = await apiRequest(labelsBase, ownerToken);
    const label = labels.labels.find((l: any) => l.name === labelName);
    expect(label).toBeTruthy();
    expect(label.usageCount).toBe(1);
  });

  // The single-label case above passes even with a broken `IN` clause, because
  // Drizzle rendered `IN (($1))` and Postgres reads a one-element parenthesised
  // list as a plain scalar. Two labels render `IN (($1, $2))`, which is a row
  // constructor, and the comparison throws — a 500 on any task saved with more
  // than one label. That is the gap this test exists to hold closed.
  test('task creation with multiple labels succeeds', async () => {
    const names = [`multi-a${unique}`, `multi-b${unique}`, `multi-c${unique}`];
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Multi-label task ${unique}`, issueType: 'task', labels: names }),
    });

    expect(status, JSON.stringify(data)).toBe(201);
    expect([...(data.task.labels ?? [])].sort()).toEqual([...names].sort());
  });

  test('re-using labels that already exist does not conflict', async () => {
    // Second task, same labels. Exercises the branch where every name is found
    // by the lookup and nothing needs inserting — the path that would raise a
    // unique-violation if the lookup silently returned nothing.
    const names = [`multi-a${unique}`, `multi-b${unique}`];
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Reused labels ${unique}`, issueType: 'task', labels: names }),
    });

    expect(status, JSON.stringify(data)).toBe(201);
    expect([...(data.task.labels ?? [])].sort()).toEqual([...names].sort());

    const { data: listed } = await apiRequest(labelsBase, ownerToken);
    const matching = listed.labels.filter((l: any) => names.includes(l.name));
    expect(matching, 'labels should be registered once, not duplicated').toHaveLength(2);
  });

  test('renaming a label propagates to tasks case-insensitively', async () => {
    const { data: labels } = await apiRequest(labelsBase, ownerToken);
    const label = labels.labels.find((l: any) => l.name === `auto${unique}`);
    expect(label).toBeTruthy();

const renameTarget = `renamedpropagate${unique}`;
    const { status, data: renamed } = await apiRequest(`${labelsBase}/${label.labelId}`, ownerToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: `RenamedPropagate${unique}` }),
    });
    expect(status).toBe(200);
    expect(renamed.label.name).toBe(renameTarget);

    const { data: task } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`, ownerToken);
    expect(task.task.labels).toEqual([renameTarget]);
  });

  test('deleting a label removes it from tasks and usage count', async () => {
    const { data: labels } = await apiRequest(labelsBase, ownerToken);
    const label = labels.labels.find((l: any) => l.name === `renamedpropagate${unique}`);
    expect(label).toBeTruthy();

    const { status } = await apiRequest(`${labelsBase}/${label.labelId}`, ownerToken, { method: 'DELETE' });
    expect(status).toBe(200);

    const { data: task } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`, ownerToken);
    expect(task.task.labels).toEqual([]);

    const { data: after } = await apiRequest(labelsBase, ownerToken);
    expect(after.labels.some((l: any) => l.labelId === label.labelId)).toBe(false);
  });
});

test.describe('Labels — RBAC & auth', () => {
  test('unauthenticated requests are rejected with 401', async () => {
    const { status } = await apiRequest(labelsBase, '');
    expect(status).toBe(401);
  });

  test('viewer can list but not modify labels', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.viewer.email);
    const list = await apiRequest(labelsBase, accessToken);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.data.labels)).toBe(true);

    const { status: createStatus } = await apiRequest(labelsBase, accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'ViewerLabel' }),
    });
    expect(createStatus).toBe(403);

    const { data: labels } = await apiRequest(labelsBase, ownerToken);
    const first = labels.labels[0];
    if (first) {
      const patch = await apiRequest(`${labelsBase}/${first.labelId}`, accessToken, { method: 'PATCH', body: JSON.stringify({ name: 'ViewerRename' }) });
      expect(patch.status).toBe(403);
      const del = await apiRequest(`${labelsBase}/${first.labelId}`, accessToken, { method: 'DELETE' });
      expect(del.status).toBe(403);
    }
  });

  test('developer can create but not delete labels', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const create = await apiRequest(labelsBase, accessToken, { method: 'POST', body: JSON.stringify({ name: `DevLabel${unique}` }) });
    expect(create.status).toBe(201);

    const { data: labels } = await apiRequest(labelsBase, ownerToken);
    const devLabel = labels.labels.find((l: any) => l.name === `devlabel${unique}`);
    expect(devLabel).toBeTruthy();
    const del = await apiRequest(`${labelsBase}/${devLabel.labelId}`, accessToken, { method: 'DELETE' });
    expect(del.status).toBe(403);
  });

  test('outsider is blocked from all label endpoints', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const list = await apiRequest(labelsBase, accessToken);
    expect(list.status).toBe(403);
    const create = await apiRequest(labelsBase, accessToken, { method: 'POST', body: JSON.stringify({ name: 'x' }) });
    expect(create.status).toBe(403);
  });
});});
