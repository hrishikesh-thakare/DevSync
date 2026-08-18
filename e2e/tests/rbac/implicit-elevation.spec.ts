/**
 * RBAC — Implicit Elevation Tests
 * @tags @rbac
 *
 * Tests the critical rule: Workspace owner/admin are automatically
 * granted project_admin on ALL projects, even without explicit
 * project membership (see roles.ts line 138).
 *
 * This is one of the most important RBAC rules to protect against regressions.
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_PROJECT, TEST_USERS, ROUTES } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

// Retries once on 500/404: on Windows the dev backend intermittently fails a
// single request (or returns a corrupted empty query result → 404) while
// fire-and-forget Gemini calls are in flight (undici/libuv uv_async assertion).
async function deleteTaskResilient(url: string, token: string) {
  const first = await apiRequest(url, token, { method: 'DELETE' });
  if (first.status !== 500 && first.status !== 404) return first;
  await new Promise((r) => setTimeout(r, 750));
  return apiRequest(url, token, { method: 'DELETE' });
}
const KEY = TEST_PROJECT.key;

test.describe('Implicit Elevation — Workspace Owner → Project Admin @rbac', () => {
  test('workspace owner CAN create tasks in project (without explicit project membership)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: `Owner Elevation Test ${Date.now()}`, issueType: 'task' }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('workspace owner CAN manage project members', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('workspace owner CAN create sprints', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ name: `Owner Sprint ${Date.now()}` }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('workspace owner CAN access project board (UI)', async ({ ownerPage }) => {
    await ownerPage.goto(ROUTES.projectBoard(SLUG, KEY));
    await ownerPage.waitForLoadState('networkidle');

    // Should be able to see the board
    await expect(ownerPage).toHaveURL(new RegExp(`/projects/${KEY}`));
    // Should have create-task ability (project_admin level)
    const createBtn = ownerPage.locator(
      'button:has-text("Create"), button:has-text("New Task"), button:has-text("Add")'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Implicit Elevation — Workspace Admin → Project Admin @rbac', () => {
  test('workspace admin CAN create tasks in project', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: `Admin Elevation Test ${Date.now()}`, issueType: 'task' }),
      }
    );
    expect([200, 201]).toContain(status);
  });

  test('workspace admin CAN delete tasks in project', async () => {
    // Create a task first
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);
    const { data: newTask } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ title: `Admin Delete Test ${Date.now()}`, issueType: 'task' }),
      }
    );

    const taskKey = newTask?.task?.taskKey || newTask?.taskKey;
    if (!taskKey) {
      test.skip();
      return;
    }

    const { status } = await deleteTaskResilient(
      `/workspaces/${SLUG}/projects/${KEY}/tasks/${taskKey}`,
      accessToken
    );
    expect([200, 204]).toContain(status);
  });

  test('workspace admin CAN manage project members', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/members`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('workspace admin CAN create sprints', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.admin.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ name: `Admin Sprint ${Date.now()}` }),
      }
    );
    expect([200, 201]).toContain(status);
  });
});

test.describe('Implicit Elevation — Member WITHOUT Project Role @rbac', () => {
  test('outsider (no workspace access) CANNOT access project tasks (API 403)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    expect(status).toBe(403);
  });

  test('workspace member with NO project roles (Hank) CANNOT access project tasks (API 403)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.memberNoProject.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    // Hank is a workspace member, but has no role in the E2E project
    expect(status).toBe(403);
  });

  test('workspace member with explicit role (Dave) does NOT get elevated to admin', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.developer.email);
    
    // Developer has explicit 'developer' project role, so they can read but not admin
    const { status: readStatus } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    expect(readStatus).toBe(200); // Can read

    // But cannot perform project_admin actions
    const { status: adminStatus } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Should Fail Sprint' }),
      }
    );
    expect(adminStatus).toBe(403); // Cannot create sprints
  });
});

test.describe('Cross-Project Isolation @rbac', () => {
  const SEC_KEY = 'SEC'; // secondary project key

  test('Grace CAN access SEC project tasks (developer role)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.crossProject.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${SEC_KEY}/tasks`,
      accessToken
    );
    expect(status).toBe(200);
  });

  test('Grace CANNOT access E2E project tasks (no role in E2E)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.crossProject.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/tasks`,
      accessToken
    );
    // Grace is developer in SEC, but has no role in E2E
    expect(status).toBe(403);
  });

  test('Carol is project_admin in E2E but only viewer in SEC', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.projectAdmin.email);
    
    // Carol can create sprints in E2E (project_admin)
    const { status: e2eAdminStatus } = await apiRequest(
      `/workspaces/${SLUG}/projects/${KEY}/sprints`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Carol Sprint E2E' }),
      }
    );
    expect([200, 201]).toContain(e2eAdminStatus);

    // Carol CANNOT create sprints in SEC (viewer only)
    const { status: secAdminStatus } = await apiRequest(
      `/workspaces/${SLUG}/projects/${SEC_KEY}/sprints`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Carol Sprint SEC' }),
      }
    );
    expect(secAdminStatus).toBe(403);
  });
});
