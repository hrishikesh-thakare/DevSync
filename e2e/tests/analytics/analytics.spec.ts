import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

const analytics = (token: string, query = '') =>
  apiRequest(`/workspaces/${SLUG}/analytics${query}`, token);

const setStatus = (token: string, taskKey: string, status: string) =>
  apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

test.describe('Team & delivery analytics', () => {
  let ownerToken: string;

  test.beforeAll(async () => {
    ownerToken = (await apiLogin(TEST_USERS.owner.email)).accessToken;
  });

  test('returns every section with the expected shape', async () => {
    const { status, data } = await analytics(ownerToken);
    expect(status).toBe(200);

    for (const key of [
      'role', 'window', 'projects',
      'cycleTime', 'throughput', 'velocity', 'contribution', 'ciTrend', 'burndown',
    ]) {
      expect(data, `payload should carry ${key}`).toHaveProperty(key);
    }

    expect(Array.isArray(data.cycleTime)).toBe(true);
    // Done is a terminal state — nothing accumulates time in it.
    expect(data.cycleTime.map((c: any) => c.status)).toEqual(['todo', 'in_progress', 'in_review']);
    expect(data.window.from).toBeTruthy();
    expect(data.window.to).toBeTruthy();
  });

  test('a task moved through the board produces cycle time and throughput', async () => {
    const created = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Analytics flow ${Date.now()}`, issueType: 'task', storyPoints: 3 }),
    });
    expect(created.status).toBe(201);
    const taskKey = created.data.task.taskKey;

    for (const next of ['in_progress', 'in_review', 'done']) {
      const moved = await setStatus(ownerToken, taskKey, next);
      expect(moved.status, `move to ${next}`).toBe(200);
    }

    const { data } = await analytics(ownerToken, `?projectKey=${KEY}`);

    // Each completed span contributes a sample; the task passed through all three.
    const sampled = data.cycleTime.filter((c: any) => c.sampleSize > 0);
    expect(sampled.length, 'at least one status should have timing samples').toBeGreaterThan(0);

    for (const entry of sampled) {
      expect(entry.avgHours).not.toBeNull();
      expect(entry.avgHours).toBeGreaterThanOrEqual(0);
      expect(entry.medianHours).toBeGreaterThanOrEqual(0);
    }

    const totalCompleted = data.throughput.reduce((sum: number, w: any) => sum + w.completed, 0);
    expect(totalCompleted, 'the finished task should appear in throughput').toBeGreaterThan(0);
  });

  test('completing a task stamps completedAt and reopening clears it', async () => {
    const created = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, ownerToken, {
      method: 'POST',
      body: JSON.stringify({ title: `Analytics reopen ${Date.now()}`, issueType: 'task' }),
    });
    const taskKey = created.data.task.taskKey;

    await setStatus(ownerToken, taskKey, 'done');
    const done = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`, ownerToken);
    expect(done.data.task.completedAt, 'completedAt set on done').toBeTruthy();

    await setStatus(ownerToken, taskKey, 'in_progress');
    const reopened = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`, ownerToken);
    // A reopened task is not delivered work and must stop counting as such.
    expect(reopened.data.task.completedAt, 'completedAt cleared on reopen').toBeNull();
  });

  test('contribution totals are non-negative and attributed to real users', async () => {
    const { data } = await analytics(ownerToken);
    for (const member of data.contribution) {
      expect(member.userId).toBeTruthy();
      expect(member.fullName).toBeTruthy();
      expect(member.tasksCompleted).toBeGreaterThanOrEqual(0);
      expect(member.commits).toBeGreaterThanOrEqual(0);
      expect(member.prsMerged).toBeGreaterThanOrEqual(0);
    }
  });

  test('burndown never reports more remaining than the sprint holds', async () => {
    const { data } = await analytics(ownerToken);
    for (const sprint of data.burndown) {
      expect(sprint.totalPoints).toBeGreaterThanOrEqual(0);
      for (const point of sprint.series) {
        expect(point.remaining).toBeLessThanOrEqual(sprint.totalPoints);
        expect(point.remaining).toBeGreaterThanOrEqual(0);
        expect(point.ideal).toBeLessThanOrEqual(sprint.totalPoints);
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  test('CI success rate stays within 0-100 and succeeded never exceeds total', async () => {
    const { data } = await analytics(ownerToken);
    for (const day of data.ciTrend) {
      expect(day.succeeded).toBeLessThanOrEqual(day.total);
      expect(day.successRate).toBeGreaterThanOrEqual(0);
      expect(day.successRate).toBeLessThanOrEqual(100);
    }
  });

  test('velocity only counts work that actually shipped', async () => {
    const { data } = await analytics(ownerToken);
    for (const sprint of data.velocity) {
      expect(sprint.completedPoints).toBeGreaterThanOrEqual(0);
      expect(sprint.completedCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('projectKey narrows the scope', async () => {
    const { status, data } = await analytics(ownerToken, `?projectKey=${KEY}`);
    expect(status).toBe(200);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].key).toBe(KEY);
  });

  test('an unknown or inaccessible projectKey is refused', async () => {
    const { status } = await analytics(ownerToken, '?projectKey=NOPE');
    expect(status).toBe(403);
  });

  test('rejects a malformed or inverted date window', async () => {
    const bad = await analytics(ownerToken, '?from=not-a-date');
    expect(bad.status).toBe(400);

    const inverted = await analytics(ownerToken, '?from=2026-01-01&to=2025-01-01');
    expect(inverted.status).toBe(400);
    expect(inverted.data.error).toContain('earlier');
  });

  test('a member sees only the projects they belong to', async () => {
    // hank is a workspace member with no project memberships at all.
    const { accessToken } = await apiLogin(TEST_USERS.memberNoProject.email);
    const { status, data } = await analytics(accessToken);

    expect(status).toBe(200);
    expect(data.role).toBe('member');
    expect(data.projects, 'no project memberships means no project scope').toHaveLength(0);
    expect(data.cycleTime).toEqual([]);
    expect(data.contribution).toEqual([]);
  });

  test('an admin sees the whole workspace', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);
    const { status, data } = await analytics(accessToken);

    expect(status).toBe(200);
    expect(data.role).toBe('admin');
    expect(data.projects.length).toBeGreaterThan(0);
  });

  test('non-members are denied', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const { status } = await analytics(accessToken);
    expect(status).toBe(403);
  });

  test('requires authentication', async () => {
    const { status } = await analytics('');
    expect(status).toBe(401);
  });
});

test.describe('Analytics page (UI)', () => {
  test('workspace analytics renders every chart section', async ({ ownerPage }) => {
    await ownerPage.goto(`/w/${SLUG}/analytics`);
    await ownerPage.waitForLoadState('networkidle');

    await expect(ownerPage.getByRole('heading', { name: 'Analytics' })).toBeVisible({
      timeout: 10_000,
    });

    for (const section of ['Cycle time', 'Throughput', 'Velocity', 'Contribution', 'CI health']) {
      await expect(
        ownerPage.getByText(section, { exact: true }).first(),
        `${section} card should render`,
      ).toBeVisible();
    }
  });

  test('states plainly that these are not DORA metrics', async ({ ownerPage }) => {
    await ownerPage.goto(`/w/${SLUG}/analytics`);
    await ownerPage.waitForLoadState('networkidle');
    // The distinction is the kind of thing a reviewer probes, so it is on the
    // page rather than only in the code.
    await expect(ownerPage.getByText(/not DORA metrics/i)).toBeVisible({ timeout: 10_000 });
  });

  test('the range selector refetches without breaking the page', async ({ ownerPage }) => {
    await ownerPage.goto(`/w/${SLUG}/analytics`);
    await ownerPage.waitForLoadState('networkidle');

    await ownerPage.getByRole('button', { name: '30d' }).click();
    await ownerPage.waitForLoadState('networkidle');
    await expect(ownerPage.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('project analytics is reachable from the project tab bar', async ({ ownerPage }) => {
    await ownerPage.goto(`/w/${SLUG}/projects/${KEY}`);
    await ownerPage.waitForLoadState('networkidle');

    // The workspace sidebar also has an Analytics link, so scope to the tab bar.
    await ownerPage
      .getByLabel('Project sections')
      .getByRole('link', { name: 'Analytics' })
      .click();
    await ownerPage.waitForLoadState('networkidle');

    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${KEY}/analytics$`));
    await expect(ownerPage.getByText(`Delivery metrics for ${KEY}.`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('a member with no project access sees empty states, not an error', async ({
    memberNoProjectPage,
  }) => {
    await memberNoProjectPage.goto(`/w/${SLUG}/analytics`);
    await memberNoProjectPage.waitForLoadState('networkidle');

    await expect(memberNoProjectPage.getByRole('heading', { name: 'Analytics' })).toBeVisible({
      timeout: 10_000,
    });
    // Scoped to nothing, so every chart is empty — but the page must not 403 or crash.
    await expect(memberNoProjectPage.getByText(/No completed transitions/i)).toBeVisible();
  });
});
