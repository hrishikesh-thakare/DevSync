import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const KEY = TEST_PROJECT.key;

// GitHub API-dependent happy paths (connect, PR/branch/comment creation, live
// commits/CI) can't run without a real OAuth token + repo, so the suite covers
// everything that is deterministic: auth, RBAC, schema validation, and the
// no-connection error paths. 403 vs 404 is used to prove a role passed the
// gate (404 = authorized but no connection), vs failed it (403).

const VALID_CONNECT_BODY = { repo_owner: 'octocat', repo_name: 'Hello-World' };
const VALID_PR_BODY = { title: 'Test PR', body: 'test', head: 'feature', base: 'main' };
const VALID_BRANCH_BODY = { branchName: 'feature/test', baseBranch: 'main' };
const VALID_COMMENT_BODY = { body: 'Test comment' };

test.describe('GitHub Integration', () => {
  test('can request OAuth URL', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest('/github/oauth/url', accessToken);
    expect([200, 500]).toContain(status);
    if (status === 200) {
      expect(data.url).toContain('github.com/login/oauth/authorize');
    }
  });

  test('connection status is initially empty', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/connection`, accessToken);
    expect(status).toBe(200);
    expect(data?.connection).toBeNull();
  });

  test('non-admin gets 403 trying to connect or disconnect', async () => {
    // developer is not project_admin by default in TEST_USERS
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    
    const { status: connectStatus } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/connect`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ repoFullName: 'test/repo' })
    });
    expect(connectStatus).toBe(403);

    const { status: disconnectStatus } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/disconnect`, accessToken, {
      method: 'DELETE'
    });
    expect(disconnectStatus).toBe(403);
  });
});

test.describe('GitHub Authentication', () => {
  test('unauthenticated requests are rejected with 401', async () => {
    const checks = [
      ['GET', '/github/oauth/url'],
      ['GET', '/github/user/repos'],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/github/connection`],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/github/commits`],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/github/ci`],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/github/issues`],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/github/pull-requests`],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/github/branches`],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/connect`],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/pull-requests`],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/branches`],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/tasks/PROJ-1/github/commits`],
      ['GET', `/workspaces/${SLUG}/projects/${KEY}/tasks/PROJ-1/github/github-activity`],
      ['POST', '/github/oauth/exchange'],
    ] as const;

    for (const [method, path] of checks) {
      const { status } = await apiRequest(path, '', { method });
      expect(status, `${method} ${path} should be 401`).toBe(401);
    }
  });
});

test.describe('GitHub RBAC', () => {
  test('viewer is denied all write endpoints with 403', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.viewer.email);
    const writes = [
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/connect`, VALID_CONNECT_BODY],
      ['DELETE', `/workspaces/${SLUG}/projects/${KEY}/github/disconnect`, undefined],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/issues/1/comments`, VALID_COMMENT_BODY],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/pull-requests`, VALID_PR_BODY],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/pull-requests/1/comments`, VALID_COMMENT_BODY],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/branches`, VALID_BRANCH_BODY],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/ci/12345678/rerun`, undefined],
    ] as const;

    for (const [method, path, body] of writes) {
      const { status } = await apiRequest(path, accessToken, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(status, `${method} ${path} should be 403 for viewer`).toBe(403);
    }
  });

  test('viewer CAN read connection status (200)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.viewer.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/connection`, accessToken);
    expect(status).toBe(200);
  });

  test('read endpoints: viewer reaches controller (200 empty), outsider blocked (403)', async () => {
    const { accessToken: viewerToken } = await apiLogin(TEST_USERS.viewer.email);
    const { accessToken: outsiderToken } = await apiLogin(TEST_USERS.outsider.email);

    const reads = [
      ['/commits', 'commits'],
      ['/ci', 'runs'],
      ['/issues', 'issues'],
      ['/pull-requests', 'pullRequests'],
      ['/branches', 'branches'],
    ] as const;

    for (const [suffix, listKey] of reads) {
      // Commits/CI/PRs are DB-backed, so without a connection the viewer gets
      // 200 with an empty list (role gate passed → controller reached).
      const viewer = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github${suffix}`, viewerToken);
      expect(viewer.status, `viewer GET ${suffix} should pass RBAC and return 200`).toBe(200);
      expect(viewer.data[listKey], `viewer GET ${suffix} should return an empty list`).toEqual([]);

      // outsider fails the workspace-membership gate → 403
      const outsider = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github${suffix}`, outsiderToken);
      expect(outsider.status, `outsider GET ${suffix} should be 403`).toBe(403);
    }
  });

  test('developer write endpoints pass RBAC but 404 without a connection', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    const writes = [
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/pull-requests`, VALID_PR_BODY],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/branches`, VALID_BRANCH_BODY],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/issues/1/comments`, VALID_COMMENT_BODY],
      ['POST', `/workspaces/${SLUG}/projects/${KEY}/github/pull-requests/1/comments`, VALID_COMMENT_BODY],
    ] as const;

    for (const [method, path, body] of writes) {
      const { status } = await apiRequest(path, accessToken, { method, body: JSON.stringify(body) });
      expect(status, `${method} ${path} should pass RBAC+validation and 404`).toBe(404);
    }
  });
});

test.describe('GitHub Input Validation', () => {
  const projectAdminTokenPromise = apiLogin(TEST_USERS.projectAdmin.email).then((r) => r.accessToken);

  test('connect requires repo_owner and repo_name', async () => {
    const token = await projectAdminTokenPromise;
    const cases = [
      {},
      { repo_owner: 'octocat' },
      { repo_name: 'Hello-World' },
      { repo_owner: '', repo_name: 'Hello-World' },
      { repo_owner: 123, repo_name: 'Hello-World' },
      { repo_owner: 'octocat', repo_name: [] },
      { repo_owner: 'octocat', repo_name: 'Hello-World', extra: 'x' },
    ];
    for (const body of cases) {
      const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/connect`, token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(status, `connect body ${JSON.stringify(body)} should be 400`).toBe(400);
      expect(data.error).toBeTruthy();
    }
  });

  test('pull request creation validates title, head, base', async () => {
    const token = await projectAdminTokenPromise;
    const cases = [
      {},
      { title: '', head: 'feature', base: 'main' },
      { title: 'x', head: '', base: 'main' },
      { title: 'x', head: 'feature', base: '' },
      { title: 42, head: 'feature', base: 'main' },
      { title: 'x', head: 'feature' },
      { title: 'x'.repeat(257), head: 'feature', base: 'main' },
    ];
    for (const body of cases) {
      const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/pull-requests`, token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(status, `PR body ${JSON.stringify(body).slice(0, 80)} should be 400`).toBe(400);
      expect(data.error).toBeTruthy();
    }
  });

  test('branch creation validates branch names', async () => {
    const token = await projectAdminTokenPromise;
    const cases = [
      {},
      { branchName: '', baseBranch: 'main' },
      { branchName: 'feature/x', baseBranch: '' },
      { branchName: 'x'.repeat(256), baseBranch: 'main' },
      { branchName: 'x', baseBranch: 'main', extra: true },
    ];
    for (const body of cases) {
      const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/branches`, token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(status, `branch body ${JSON.stringify(body).slice(0, 80)} should be 400`).toBe(400);
      expect(data.error).toBeTruthy();
    }
  });

  test('issue and PR comments require non-empty body', async () => {
    const token = await projectAdminTokenPromise;
    for (const path of ['/issues/1/comments', '/pull-requests/1/comments']) {
      for (const body of [{}, { body: '' }, { body: 42 }]) {
        const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github${path}`, token, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        expect(status, `comment ${path} body ${JSON.stringify(body)} should be 400`).toBe(400);
        expect(data.error).toBeTruthy();
      }
    }
  });

  test('oauth exchange validates providerToken', async () => {
    const token = await projectAdminTokenPromise;
    for (const body of [{}, { providerToken: '' }, { providerToken: 42 }]) {
      const { status, data } = await apiRequest('/github/oauth/exchange', token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(status, `exchange body ${JSON.stringify(body)} should be 400`).toBe(400);
      expect(data.error).toBeTruthy();
    }
  });
});

test.describe('GitHub No-Connection Error Paths', () => {
  // A freshly registered user with no GitHub account: connect must fail with
  // 403 "GitHub account is not connected" BEFORE any GitHub API call.
  test('connect fails with 403 when the user has no GitHub token', async () => {
    const email = `github-connect-${Date.now()}@demo.com`;
    const { status: regStatus, data: regData } = await apiRequest('/auth/register', '', {
      method: 'POST',
      body: JSON.stringify({ email, fullName: 'GitHub Tester', password: 'TestPassword123!' }),
    });
    expect(regStatus).toBeLessThan(400);
    const token = regData.accessToken;

    const slug = `gh-connect-${Date.now()}`;
    const ws = await apiRequest('/workspaces', token, {
      method: 'POST',
      body: JSON.stringify({ name: 'GitHub Connect Test', slug }),
    });
    expect(ws.status).toBeLessThan(400);

    const key = `GHC${Date.now().toString().slice(-4)}`;
    const proj = await apiRequest(`/workspaces/${slug}/projects`, token, {
      method: 'POST',
      body: JSON.stringify({ name: 'GitHub Connect Project', key }),
    });
    expect(proj.status).toBeLessThan(400);

    const { status, data } = await apiRequest(`/workspaces/${slug}/projects/${key}/github/connect`, token, {
      method: 'POST',
      body: JSON.stringify(VALID_CONNECT_BODY),
    });
    expect(status).toBe(403);
    expect(data.error).toContain('GitHub account is not connected');

    // disconnect with no connection → 404
    const disc = await apiRequest(`/workspaces/${slug}/projects/${key}/github/disconnect`, token, { method: 'DELETE' });
    expect(disc.status).toBe(404);

    // cleanup
    await apiRequest(`/workspaces/${slug}`, token, { method: 'DELETE' });
  });

  test('disconnect without a connection returns 404', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.projectAdmin.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/github/disconnect`, accessToken, {
      method: 'DELETE',
    });
    expect(status).toBe(404);
    expect(data.error).toContain('No GitHub connection found');
  });

  test('task-level endpoints behave deterministically without a connection', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);

    // Find an existing task in the E2E project
    const tasks = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks`, accessToken);
    const taskKey = tasks.data?.tasks?.[0]?.taskKey || tasks.data?.[0]?.taskKey;
    test.skip(!taskKey, 'No tasks exist in the E2E project');

    // Commits are DB-backed → 200 with an empty list (no connection needed)
    const commits = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}/github/commits`, accessToken);
    expect(commits.status).toBe(200);
    expect(commits.data.commits).toEqual([]);

    // Activity is DB-backed → 200 with empty arrays (no connection needed)
    const activity = await apiRequest(`/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}/github/github-activity`, accessToken);
    expect(activity.status).toBe(200);
    expect(activity.data.pullRequests).toEqual([]);
    expect(activity.data.issues).toEqual([]);
    expect(activity.data.branches).toEqual([]);
    expect(activity.data.commits).toEqual([]);
  });
});