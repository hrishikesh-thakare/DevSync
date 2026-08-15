/**
 * DevSync E2E Seed Script
 *
 * Seeds the test database with users, workspaces, multiple projects, and
 * fine-grained role assignments needed for comprehensive RBAC E2E tests.
 * This script talks directly to the backend API — no direct DB access needed.
 *
 * Run: `npx tsx seed/seed-test-data.ts`
 *
 * Prerequisites: Backend must be running at API_URL.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        ROLE ASSIGNMENT MATRIX                         │
 * ├──────────────┬─────────────────┬───────────────────┬──────────────────┤
 * │ User         │ Workspace Role  │ Project E2E Role  │ Project SEC Role │
 * ├──────────────┼─────────────────┼───────────────────┼──────────────────┤
 * │ Alice        │ owner           │ (implicit admin)  │ (implicit admin) │
 * │ Bob          │ admin           │ (implicit admin)  │ (implicit admin) │
 * │ Carol        │ member          │ project_admin     │ viewer           │
 * │ Dave         │ member          │ developer         │ developer        │
 * │ Eve          │ member          │ viewer            │ —                │
 * │ Frank        │ —  (outsider)   │ —                 │ —                │
 * │ Grace        │ member          │ —                 │ developer        │
 * │ Hank         │ member          │ —                 │ —                │
 * └──────────────┴─────────────────┴───────────────────┴──────────────────┘
 *
 * Key testing scenarios this enables:
 * • Alice/Bob: implicit elevation from workspace owner/admin → project_admin
 * • Carol: explicit project_admin on E2E, viewer on SEC (cross-project role diff)
 * • Dave: developer on both projects (consistent cross-project)
 * • Eve: viewer on E2E, no role on SEC (partial access)
 * • Frank: complete outsider — no workspace membership at all
 * • Grace: workspace member with SEC access but NO E2E access (isolation)
 * • Hank: workspace member with NO project roles (pure workspace member)
 */
import {
  TEST_USERS,
  TEST_WORKSPACE,
  TEST_PROJECT,
  TEST_PROJECT_2,
} from '../helpers/constants.js';
import { apiRequest, apiLogin, getAuthToken } from '../helpers/api-helpers.js';

// Build a reverse email → role map for cache lookups
const EMAIL_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(TEST_USERS).map(([role, u]) => [u.email, role])
);

// ─── Utility Functions ──────────────────────────────────────────────────────

async function register(user: { email: string; name: string; password: string }) {
  const { status, data } = await apiRequest('/auth/register', '', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      fullName: user.name,
      password: user.password,
    }),
  });

  if (status === 409 || status === 400) {
    console.log(`  ⏭️  User ${user.email} already exists, logging in...`);
    // apiLogin() checks the cached token expiry — only hits the API if expired
    return apiLogin(user.email, user.password);
  }

  if (status >= 400) {
    throw new Error(`Registration failed for ${user.email}: ${status} ${JSON.stringify(data)}`);
  }

  console.log(`  ✅ Registered ${user.email}`);
  return data;
}



async function createProjectIfNotExists(
  token: string,
  slug: string,
  project: { name: string; key: string }
) {
  const { status, data } = await apiRequest(
    `/workspaces/${slug}/projects`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ name: project.name, key: project.key }),
    }
  );

  if (status === 409 || status === 400) {
    console.log(`  ⏭️  Project "${project.key}" already exists`);
  } else if (status >= 400) {
    throw new Error(`Failed to create project ${project.key}: ${status} ${JSON.stringify(data)}`);
  } else {
    console.log(`  ✅ Created project "${project.key}" (${project.name})`);
  }
}

async function addProjectMember(
  token: string,
  slug: string,
  projectKey: string,
  userId: string,
  role: string,
  label: string
) {
  const { status, data } = await apiRequest(
    `/workspaces/${slug}/projects/${projectKey}/members`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }
  );

  if (status === 409 || status === 400) {
    console.log(`  ⏭️  ${label} already in project ${projectKey}`);
  } else if (status >= 400) {
    console.warn(`  ⚠️  Failed to add ${label} to ${projectKey}: ${status} ${JSON.stringify(data)}`);
  } else {
    console.log(`  ✅ Added ${label} → ${projectKey} as ${role}`);
  }
}

// ─── Main Seed Function ─────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 DevSync E2E Seed Script\n');
  console.log('━'.repeat(60));

  // ─── Step 1: Register all test users ─────────────────────────────────────
  console.log('\n📋 Step 1: Registering test users...\n');
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};

  for (const [role, user] of Object.entries(TEST_USERS)) {
    const result = await register(user);
    tokens[role] = result.accessToken;
    userIds[role] = result.user?.userId || result.userId;
  }

  // ─── Step 2: Create the test workspace ───────────────────────────────────
  console.log('\n📋 Step 2: Creating test workspace...\n');
  const { status: wsStatus, data: wsData } = await apiRequest('/workspaces', tokens.owner, {
    method: 'POST',
    body: JSON.stringify({
      name: TEST_WORKSPACE.name,
      slug: TEST_WORKSPACE.slug,
    }),
  });

  if (wsStatus === 409) {
    console.log(`  ⏭️  Workspace "${TEST_WORKSPACE.slug}" already exists (slug conflict - slug owned by current user or another)`);
  } else if (wsStatus === 201 || wsStatus === 200) {
    console.log(`  ✅ Created workspace "${TEST_WORKSPACE.slug}"`);
  } else {
    throw new Error(`Failed to create workspace: ${wsStatus} ${JSON.stringify(wsData)}`);
  }


  // ─── Step 3: Invite workspace members ────────────────────────────────────
  console.log('\n📋 Step 3: Inviting workspace members...\n');
  const membersToInvite = [
    { role: 'admin',          email: TEST_USERS.admin.email,          workspaceRole: 'admin'  },
    { role: 'projectAdmin',   email: TEST_USERS.projectAdmin.email,   workspaceRole: 'member' },
    { role: 'developer',      email: TEST_USERS.developer.email,      workspaceRole: 'member' },
    { role: 'viewer',         email: TEST_USERS.viewer.email,         workspaceRole: 'member' },
    { role: 'crossProject',   email: TEST_USERS.crossProject.email,   workspaceRole: 'member' },
    { role: 'memberNoProject', email: TEST_USERS.memberNoProject.email, workspaceRole: 'member' },
    // Note: outsider (Frank) is intentionally NOT invited
  ];

  for (const member of membersToInvite) {
    const { status, data } = await apiRequest(
      `/workspaces/${TEST_WORKSPACE.slug}/invite`,
      tokens.owner,
      {
        method: 'POST',
        body: JSON.stringify({
          email: member.email,
          role: member.workspaceRole,
        }),
      }
    );

    if (status === 409 || status === 400) {
      console.log(`  ⏭️  ${member.email} already in workspace`);
    } else if (status >= 400) {
      console.warn(`  ⚠️  Failed to invite ${member.email}: ${status} ${JSON.stringify(data)}`);
    } else {
      console.log(`  ✅ Invited ${member.email} as workspace ${member.workspaceRole}`);

      // Accept the invite
      const { status: acceptStatus } = await apiRequest(
        `/workspaces/${TEST_WORKSPACE.slug}/invites/accept`,
        tokens[member.role],
        { method: 'POST' }
      );
      if (acceptStatus < 400) {
        console.log(`  ✅ ${member.email} accepted invite`);
      }
    }
  }

  // ─── Step 4: Create both test projects ───────────────────────────────────
  console.log('\n📋 Step 4: Creating test projects...\n');
  await createProjectIfNotExists(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT);
  await createProjectIfNotExists(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT_2);

  // ─── Step 5: Assign project members (E2E project) ───────────────────────
  console.log('\n📋 Step 5: Assigning members to E2E project...\n');

  // E2E project: Carol=project_admin, Dave=developer, Eve=viewer
  // Owner/Admin get implicit project_admin. Grace, Hank, Frank = NO access.
  await addProjectMember(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT.key, userIds.projectAdmin, 'project_admin', 'Carol (projectAdmin)');
  await addProjectMember(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT.key, userIds.developer, 'developer', 'Dave (developer)');
  await addProjectMember(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT.key, userIds.viewer, 'viewer', 'Eve (viewer)');

  // ─── Step 6: Assign project members (SEC project) ───────────────────────
  console.log('\n📋 Step 6: Assigning members to SEC project...\n');

  // SEC project: Carol=viewer, Dave=developer, Grace=developer
  // Eve, Hank, Frank = NO access to SEC.
  await addProjectMember(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT_2.key, userIds.projectAdmin, 'viewer', 'Carol (viewer on SEC)');
  await addProjectMember(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT_2.key, userIds.developer, 'developer', 'Dave (developer on SEC)');
  await addProjectMember(tokens.owner, TEST_WORKSPACE.slug, TEST_PROJECT_2.key, userIds.crossProject, 'developer', 'Grace (developer on SEC only)');

  // ─── Step 7: Create starter tasks in E2E project ────────────────────────
  console.log('\n📋 Step 7: Creating test tasks in E2E project...\n');
  const testTasks = [
    { title: 'E2E Test Task - Todo',        issueType: 'task', priority: 'medium', status: 'todo' },
    { title: 'E2E Test Task - In Progress', issueType: 'task', priority: 'high',   status: 'in_progress' },
    { title: 'E2E Test Bug',               issueType: 'bug',  priority: 'critical', status: 'todo' },
    { title: 'E2E Story - Backlog',         issueType: 'story', priority: 'low',    status: 'todo' },
  ];

  for (const task of testTasks) {
    const { status, data } = await apiRequest(
      `/workspaces/${TEST_WORKSPACE.slug}/projects/${TEST_PROJECT.key}/tasks`,
      tokens.owner,
      { method: 'POST', body: JSON.stringify(task) }
    );

    if (status >= 400) {
      console.warn(`  ⚠️  Failed to create task "${task.title}": ${status} ${JSON.stringify(data)}`);
    } else {
      console.log(`  ✅ Created task "${task.title}" (${data?.task?.taskKey || data?.taskKey || '?'})`);
    }
  }

  // ─── Step 8: Create tasks in SEC project ─────────────────────────────────
  console.log('\n📋 Step 8: Creating test tasks in SEC project...\n');
  const secTasks = [
    { title: 'SEC Task - Auth Audit',    issueType: 'task', priority: 'high' },
    { title: 'SEC Task - Pentest Prep',  issueType: 'task', priority: 'medium' },
  ];

  for (const task of secTasks) {
    const { status, data } = await apiRequest(
      `/workspaces/${TEST_WORKSPACE.slug}/projects/${TEST_PROJECT_2.key}/tasks`,
      tokens.owner,
      { method: 'POST', body: JSON.stringify(task) }
    );

    if (status >= 400) {
      console.warn(`  ⚠️  Failed to create SEC task "${task.title}": ${status} ${JSON.stringify(data)}`);
    } else {
      console.log(`  ✅ Created task "${task.title}" (${data?.task?.taskKey || data?.taskKey || '?'})`);
    }
  }

  // ─── Step 9: Create a sprint in E2E project ─────────────────────────────
  console.log('\n📋 Step 9: Creating test sprint...\n');
  const { status: sprintStatus, data: sprintData } = await apiRequest(
    `/workspaces/${TEST_WORKSPACE.slug}/projects/${TEST_PROJECT.key}/sprints`,
    tokens.owner,
    {
      method: 'POST',
      body: JSON.stringify({ name: 'Sprint 1 - E2E', goal: 'E2E test sprint' }),
    }
  );

  if (sprintStatus === 409 || sprintStatus === 400) {
    console.log(`  ⏭️  Sprint already exists`);
  } else if (sprintStatus >= 400) {
    console.warn(`  ⚠️  Failed to create sprint: ${sprintStatus} ${JSON.stringify(sprintData)}`);
  } else {
    console.log(`  ✅ Created sprint "Sprint 1 - E2E"`);
  }

  // ─── Step 10: Create test channels ───────────────────────────────────────
  console.log('\n📋 Step 10: Creating test channels...\n');
  const channels = [
    { name: 'e2e-general',       type: 'public',  description: 'General E2E test channel' },
    { name: 'e2e-announcements', type: 'public',  description: 'Announcements channel for testing' },
  ];

  for (const ch of channels) {
    const { status, data } = await apiRequest(
      `/workspaces/${TEST_WORKSPACE.slug}/channels`,
      tokens.owner,
      { method: 'POST', body: JSON.stringify(ch) }
    );

    if (status === 409 || status === 400 || status === 500) {
      console.log(`  ⏭️  Channel "${ch.name}" already exists`);
    } else if (status >= 400) {
      console.warn(`  ⚠️  Failed to create channel "${ch.name}": ${status} ${JSON.stringify(data)}`);
    } else {
      console.log(`  ✅ Created channel "${ch.name}"`);
    }
  }

  // ─── Done ────────────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(60));
  console.log('🎉 Seed complete! Test data is ready.\n');
  console.log('Test workspace:', TEST_WORKSPACE.slug);
  console.log('Test projects:  ', TEST_PROJECT.key, '(primary),', TEST_PROJECT_2.key, '(secondary)');
  console.log('Test users:     ', Object.keys(TEST_USERS).length, 'users seeded');
  console.log('');
}

seed().catch((err) => {
  console.error('\n💥 Seed failed:', err);
  process.exit(1);
});
