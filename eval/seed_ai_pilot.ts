import { getEvalSql } from './db.js';

const PASSWORD_HASH = '$2b$10$CEqoBuXmKeVur02/5KkPKutdV50UvRfpVjFuUlkBc5M04gsEWmcZq'; // Password123!

export const AI_USERS = {
  alice: {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'alice@correctness.test',
    fullName: 'Alice Test',
  },
  bob: {
    userId: '22222222-2222-4222-8222-222222222222',
    email: 'bob@correctness.test',
    fullName: 'Bob Test',
  },
  charlie: {
    userId: '33333333-3333-4333-8333-333333333333',
    email: 'charlie@correctness.test',
    fullName: 'Charlie Test',
  },
};

export const AI_WORKSPACE_SLUG = 'ai-eval-ws';
export const AI_PROJECT_KEY = 'AIP';

export interface PilotSprintTask {
  taskKey: string;
  title: string;
  issueType: string;
  status: string;
  assignee: { userId: string; fullName: string };
  storyPoints: number;
  descriptionText: string;
}

export interface PilotSprintDef {
  sprintId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  characteristic: string;
  tasks: PilotSprintTask[];
}

export const PILOT_SPRINTS: PilotSprintDef[] = [
  // ─── Sprint 1: High Completion (100%) ───────────────────────────────────────
  {
    sprintId: 'a1111111-0000-4000-8000-000000000001',
    name: 'Sprint 1 - Core Auth & Onboarding',
    goal: 'Deliver user authentication and onboarding flow',
    startDate: '2026-03-02T09:00:00Z',
    endDate: '2026-03-13T18:00:00Z',
    characteristic: 'High Completion (100%), multi-contributor',
    tasks: [
      {
        taskKey: 'AIP-1',
        title: 'Implement JWT token rotation',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.alice,
        storyPoints: 3,
        descriptionText: 'Implement refresh token family rotation with automatic reuse detection.',
      },
      {
        taskKey: 'AIP-2',
        title: 'Setup email verification flow',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.alice,
        storyPoints: 5,
        descriptionText: 'Send email confirmation links via SendGrid HTTP API upon registration.',
      },
      {
        taskKey: 'AIP-3',
        title: 'Fix password reset token expiration',
        issueType: 'bug',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 2,
        descriptionText: 'Ensure password reset tokens expire after 15 minutes of inactivity.',
      },
      {
        taskKey: 'AIP-4',
        title: 'Add account lockout after failed logins',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 3,
        descriptionText: 'Freeze accounts for 15 minutes after 5 consecutive failed login attempts.',
      },
      {
        taskKey: 'AIP-5',
        title: 'Implement user session persistence',
        issueType: 'task',
        status: 'done',
        assignee: AI_USERS.charlie,
        storyPoints: 3,
        descriptionText: 'Store active session tokens in PostgreSQL and allow remote sign-out.',
      },
      {
        taskKey: 'AIP-6',
        title: 'Create sign-up and login UI',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.alice,
        storyPoints: 5,
        descriptionText: 'Build responsive sign-in and sign-up cards using React and Tailwind CSS.',
      },
      {
        taskKey: 'AIP-7',
        title: 'Add rate limiting on auth endpoints',
        issueType: 'task',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 2,
        descriptionText: 'Limit IP login attempts to 10 per minute using express rate limiter.',
      },
      {
        taskKey: 'AIP-8',
        title: 'Write unit tests for auth middleware',
        issueType: 'task',
        status: 'done',
        assignee: AI_USERS.charlie,
        storyPoints: 3,
        descriptionText: 'Cover requireAuth and token signature verification with Vitest.',
      },
    ],
  },

  // ─── Sprint 2: Low Completion (30%) ────────────────────────────────────────
  {
    sprintId: 'a2222222-0000-4000-8000-000000000002',
    name: 'Sprint 2 - Database Migration & Storage',
    goal: 'Migrate database schema and implement storage adapters',
    startDate: '2026-03-16T09:00:00Z',
    endDate: '2026-03-27T18:00:00Z',
    characteristic: 'Low Completion (30%), heavy work in progress and review',
    tasks: [
      {
        taskKey: 'AIP-9',
        title: 'Configure Drizzle ORM relations',
        issueType: 'task',
        status: 'done',
        assignee: AI_USERS.alice,
        storyPoints: 3,
        descriptionText: 'Define primary foreign key relations across workspaces and projects.',
      },
      {
        taskKey: 'AIP-10',
        title: 'Create initial schema migrations',
        issueType: 'task',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 5,
        descriptionText: 'Generate SQL migration files for users, tasks, and channels tables.',
      },
      {
        taskKey: 'AIP-11',
        title: 'Setup Supabase storage bucket',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.charlie,
        storyPoints: 3,
        descriptionText: 'Initialize attachments bucket and configure public and private access policies.',
      },
      {
        taskKey: 'AIP-12',
        title: 'Implement multipart file upload',
        issueType: 'feature',
        status: 'in_progress',
        assignee: AI_USERS.alice,
        storyPoints: 8,
        descriptionText: 'Support chunked uploading for files exceeding 100MB with progress bars.',
      },
      {
        taskKey: 'AIP-13',
        title: 'Add thumbnail generation for images',
        issueType: 'task',
        status: 'in_progress',
        assignee: AI_USERS.bob,
        storyPoints: 5,
        descriptionText: 'Generate 200x200 JPEG previews using Sharp upon image file upload.',
      },
      {
        taskKey: 'AIP-14',
        title: 'Support S3 presigned download URLs',
        issueType: 'feature',
        status: 'in_review',
        assignee: AI_USERS.charlie,
        storyPoints: 5,
        descriptionText: 'Generate time-limited signed download URLs expiring after 60 minutes.',
      },
      {
        taskKey: 'AIP-15',
        title: 'Implement file deletion cascading',
        issueType: 'bug',
        status: 'in_review',
        assignee: AI_USERS.alice,
        storyPoints: 3,
        descriptionText: 'Delete underlying storage objects when parent task attachment is deleted.',
      },
      {
        taskKey: 'AIP-16',
        title: 'Handle storage quota enforcement',
        issueType: 'task',
        status: 'todo',
        assignee: AI_USERS.bob,
        storyPoints: 5,
        descriptionText: 'Cap total workspace storage to 5GB on free tier plans.',
      },
      {
        taskKey: 'AIP-17',
        title: 'Benchmark file download latency',
        issueType: 'task',
        status: 'todo',
        assignee: AI_USERS.charlie,
        storyPoints: 3,
        descriptionText: 'Measure time-to-first-byte across regional edge CDN locations.',
      },
      {
        taskKey: 'AIP-18',
        title: 'Write integration tests for storage',
        issueType: 'task',
        status: 'todo',
        assignee: AI_USERS.alice,
        storyPoints: 5,
        descriptionText: 'Test concurrent uploads and corrupt file rejection in CI test suite.',
      },
    ],
  },

  // ─── Sprint 3: Many Carried-Over Tasks (28.6% Completion) ───────────────────
  {
    sprintId: 'a3333333-0000-4000-8000-000000000003',
    name: 'Sprint 3 - API Performance & Stalled Reviews',
    goal: 'Clear carried-over storage bottlenecks and optimize query latency',
    startDate: '2026-03-30T09:00:00Z',
    endDate: '2026-04-10T18:00:00Z',
    characteristic: 'Many Carried-Over Tasks (71.4% carried over), stalled review pipeline',
    tasks: [
      {
        taskKey: 'AIP-19',
        title: 'Resolve N+1 query on project task listing',
        issueType: 'bug',
        status: 'done',
        assignee: AI_USERS.alice,
        storyPoints: 3,
        descriptionText: 'Replace per-task assignee fetch with joined relational batch query.',
      },
      {
        taskKey: 'AIP-20',
        title: 'Add Redis caching for user presence',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.charlie,
        storyPoints: 5,
        descriptionText: 'Cache online user heartbeats in memory instead of direct database updates.',
      },
      {
        taskKey: 'AIP-21',
        title: 'Fix slow query on workspace member join',
        issueType: 'bug',
        status: 'in_review',
        assignee: AI_USERS.bob,
        storyPoints: 5,
        descriptionText: 'Carried over from prior sprint: member permission subquery is missing composite index.',
      },
      {
        taskKey: 'AIP-22',
        title: 'Optimize analytics aggregation query',
        issueType: 'task',
        status: 'in_review',
        assignee: AI_USERS.alice,
        storyPoints: 8,
        descriptionText: 'Carried over: rewrite lead/dwell window function to use indexed timestamp spans.',
      },
      {
        taskKey: 'AIP-23',
        title: 'Investigate database connection pool exhaustion',
        issueType: 'bug',
        status: 'in_progress',
        assignee: AI_USERS.bob,
        storyPoints: 5,
        descriptionText: 'Carried over: idle connection leaks under simulated spike load.',
      },
      {
        taskKey: 'AIP-24',
        title: 'Add indexes on task status transitions',
        issueType: 'task',
        status: 'in_progress',
        assignee: AI_USERS.charlie,
        storyPoints: 3,
        descriptionText: 'Carried over: create composite B-tree index on (project_id, changed_at).',
      },
      {
        taskKey: 'AIP-25',
        title: 'Implement HTTP response gzip compression',
        issueType: 'task',
        status: 'todo',
        assignee: AI_USERS.alice,
        storyPoints: 2,
        descriptionText: 'Carried over: enable compression middleware for payloads exceeding 1KB.',
      },
    ],
  },

  // ─── Sprint 4: Solo Contributor (80% Completion) ───────────────────────────
  {
    sprintId: 'a4444444-0000-4000-8000-000000000004',
    name: 'Sprint 4 - GitHub Integration Pipeline',
    goal: 'Build GitHub webhook event parser and commit linking',
    startDate: '2026-04-13T09:00:00Z',
    endDate: '2026-04-24T18:00:00Z',
    characteristic: 'Solo Contributor (100% of tasks assigned to Bob)',
    tasks: [
      {
        taskKey: 'AIP-26',
        title: 'Setup GitHub HMAC webhook verification',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 3,
        descriptionText: 'Validate incoming X-Hub-Signature-256 header using crypto HMAC SHA-256.',
      },
      {
        taskKey: 'AIP-27',
        title: 'Parse push commits and link to task key',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 5,
        descriptionText: 'Extract task keys from commit message headlines and increment linked count.',
      },
      {
        taskKey: 'AIP-28',
        title: 'Handle pull request open and merge events',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 5,
        descriptionText: 'Auto-move task to in_review on PR open, and to done on default branch merge.',
      },
      {
        taskKey: 'AIP-29',
        title: 'Display linked commit history on task modal',
        issueType: 'feature',
        status: 'done',
        assignee: AI_USERS.bob,
        storyPoints: 3,
        descriptionText: 'Render commit SHA, author avatar, and relative timestamp in task detail tab.',
      },
      {
        taskKey: 'AIP-30',
        title: 'Support branch deletion webhook events',
        issueType: 'task',
        status: 'in_progress',
        assignee: AI_USERS.bob,
        storyPoints: 2,
        descriptionText: 'Soft-delete linked branch records when branch is deleted on remote.',
      },
    ],
  },

  // ─── Sprint 5: Empty Sprint (0 Tasks) ──────────────────────────────────────
  {
    sprintId: 'a5555555-0000-4000-8000-000000000005',
    name: 'Sprint 5 - Architecture Buffer & Planning',
    goal: 'Sprint planning and architectural spike buffer',
    startDate: '2026-04-27T09:00:00Z',
    endDate: '2026-05-08T18:00:00Z',
    characteristic: 'Empty Sprint (0 tasks assigned)',
    tasks: [],
  },
];

export async function seedAiPilotDataset() {
  const sql = getEvalSql(5);
  console.log('=== Seeding AI Pilot Dataset (5 Sprints) ===\n');

  try {
    // 1. Clean previous AI pilot data
    await sql`DELETE FROM workspaces WHERE slug = ${AI_WORKSPACE_SLUG}`;

    // Ensure test users exist
    for (const u of Object.values(AI_USERS)) {
      await sql`
        INSERT INTO users (user_id, email, full_name, display_name, password_hash, email_verified_at, presence, created_at, updated_at)
        VALUES (${u.userId}, ${u.email}, ${u.fullName}, ${u.fullName.split(' ')[0]}, ${PASSWORD_HASH}, '2026-01-01T00:00:00Z', 'offline', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        ON CONFLICT (user_id) DO NOTHING
      `;
    }

    // 2. Insert Workspace & Project
    const workspaceId = '00000000-0000-4000-8000-000000000010';
    await sql`
      INSERT INTO workspaces (workspace_id, name, slug, owner_id, created_at, updated_at)
      VALUES (${workspaceId}, 'AI Evaluation Workspace', ${AI_WORKSPACE_SLUG}, ${AI_USERS.alice.userId}, '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')
    `;

    for (const u of Object.values(AI_USERS)) {
      await sql`
        INSERT INTO workspace_members (id, workspace_id, user_id, role, state, joined_at)
        VALUES (${crypto.randomUUID()}, ${workspaceId}, ${u.userId}, ${u.userId === AI_USERS.alice.userId ? 'owner' : 'member'}, 'active', '2026-03-01T00:00:00Z')
      `;
    }

    const projectId = '00000000-0000-4000-8000-000000000020';
    await sql`
      INSERT INTO projects (project_id, workspace_id, key, name, description, status, issue_counter, created_at, updated_at)
      VALUES (${projectId}, ${workspaceId}, ${AI_PROJECT_KEY}, 'AI Pilot Project', 'Empirical validation project for AI features', 'active', 30, '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')
    `;

    for (const u of Object.values(AI_USERS)) {
      await sql`
        INSERT INTO project_members (id, project_id, user_id, role, added_at)
        VALUES (${crypto.randomUUID()}, ${projectId}, ${u.userId}, ${u.userId === AI_USERS.alice.userId ? 'project_admin' : 'developer'}, '2026-03-01T00:00:00Z')
      `;
    }

    // 3. Insert 5 Sprints and Tasks
    let sequenceNumber = 1;
    for (const s of PILOT_SPRINTS) {
      const completedCount = s.tasks.filter((t) => t.status === 'done').length;
      const totalPoints = s.tasks.reduce((sum, t) => sum + t.storyPoints, 0);

      console.log(`Inserting ${s.name} (${s.tasks.length} tasks, ${completedCount} completed)...`);

      await sql`
        INSERT INTO sprints (sprint_id, project_id, name, goal, status, sequence_number, start_date, end_date, closed_at, closed_by, velocity_issues, capacity_points, created_at, updated_at)
        VALUES (${s.sprintId}, ${projectId}, ${s.name}, ${s.goal}, 'closed', ${sequenceNumber}, ${s.startDate}, ${s.endDate}, ${s.endDate}, ${AI_USERS.alice.userId}, ${completedCount}, ${totalPoints}, ${s.startDate}, ${s.endDate})
      `;

      for (const t of s.tasks) {
        const taskId = crypto.randomUUID();
        const isDone = t.status === 'done';

        await sql`
          INSERT INTO tasks (task_id, task_key, project_id, sprint_id, title, description_text, status, issue_type, priority, reporter_id, assignee_id, story_points, completed_at, created_at, updated_at)
          VALUES (${taskId}, ${t.taskKey}, ${projectId}, ${s.sprintId}, ${t.title}, ${t.descriptionText}, ${t.status}, ${t.issueType}, 'medium', ${AI_USERS.alice.userId}, ${t.assignee.userId}, ${t.storyPoints}, ${isDone ? s.endDate : null}, ${s.startDate}, ${isDone ? s.endDate : s.startDate})
        `;

        await sql`
          INSERT INTO sprint_tasks (id, sprint_id, task_id, was_completed_in_sprint)
          VALUES (${crypto.randomUUID()}, ${s.sprintId}, ${taskId}, ${isDone})
        `;
      }

      sequenceNumber++;
    }

    console.log('\n✓ AI Pilot dataset (5 sprints, 30 tasks) successfully seeded!');
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed_ai_pilot.ts')) {
  seedAiPilotDataset().catch((err) => {
    console.error('Fatal seed error:', err);
    process.exit(1);
  });
}
