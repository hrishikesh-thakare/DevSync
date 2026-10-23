import { getEvalSql } from './db.js';

const PASSWORD_HASH = '$2b$10$CEqoBuXmKeVur02/5KkPKutdV50UvRfpVjFuUlkBc5M04gsEWmcZq'; // Password123!

export const USERS = {
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

export const WORKSPACE_SLUG = 'correctness-ws';
export const PROJECT_KEY = 'VAL';

export async function seedCorrectnessDataset() {
  const sql = getEvalSql(5);
  console.log('=== Seeding Hand-Verifiable Correctness Dataset ===\n');

  try {
    // 1. Clean previous correctness data
    await sql`DELETE FROM workspaces WHERE slug = ${WORKSPACE_SLUG}`;
    await sql`DELETE FROM users WHERE email LIKE '%@correctness.test'`;

    // 2. Insert Users
    console.log('Inserting 3 test users...');
    for (const u of Object.values(USERS)) {
      await sql`
        INSERT INTO users (user_id, email, full_name, display_name, password_hash, email_verified_at, presence, created_at, updated_at)
        VALUES (${u.userId}, ${u.email}, ${u.fullName}, ${u.fullName.split(' ')[0]}, ${PASSWORD_HASH}, '2026-01-01T00:00:00Z', 'offline', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
      `;
    }

    // 3. Insert Workspace & Project
    console.log('Creating workspace and project...');
    const workspaceId = '00000000-0000-4000-8000-000000000001';
    await sql`
      INSERT INTO workspaces (workspace_id, name, slug, owner_id, created_at, updated_at)
      VALUES (${workspaceId}, 'Correctness Test Workspace', ${WORKSPACE_SLUG}, ${USERS.alice.userId}, '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')
    `;

    for (const u of Object.values(USERS)) {
      await sql`
        INSERT INTO workspace_members (id, workspace_id, user_id, role, state, joined_at)
        VALUES (${crypto.randomUUID()}, ${workspaceId}, ${u.userId}, ${u.userId === USERS.alice.userId ? 'owner' : 'member'}, 'active', '2026-03-01T00:00:00Z')
      `;
    }

    const projectId = '00000000-0000-4000-8000-000000000002';
    await sql`
      INSERT INTO projects (project_id, workspace_id, key, name, description, status, issue_counter, created_at, updated_at)
      VALUES (${projectId}, ${workspaceId}, ${PROJECT_KEY}, 'Validation Project', 'Hand-verified analytics test project', 'active', 20, '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')
    `;

    for (const u of Object.values(USERS)) {
      await sql`
        INSERT INTO project_members (id, project_id, user_id, role, added_at)
        VALUES (${crypto.randomUUID()}, ${projectId}, ${u.userId}, ${u.userId === USERS.alice.userId ? 'project_admin' : 'developer'}, '2026-03-01T00:00:00Z')
      `;
    }

    // Channel
    const channelId = '00000000-0000-4000-8000-000000000003';
    await sql`
      INSERT INTO channels (channel_id, workspace_id, project_id, name, slug, description, type, is_default, created_at)
      VALUES (${channelId}, ${workspaceId}, ${projectId}, 'general', 'correctness-general', 'General channel for validation', 'public', true, '2026-03-01T00:00:00Z')
    `;

    // 4. Sprints
    console.log('Creating Sprints 1 and 2...');
    const sprint1Id = '11111111-0000-4000-8000-000000000001';
    const sprint2Id = '22222222-0000-4000-8000-000000000002';

    await sql`
      INSERT INTO sprints (sprint_id, project_id, name, goal, status, sequence_number, start_date, end_date, closed_at, closed_by, velocity_issues, capacity_points, created_at, updated_at)
      VALUES
        (${sprint1Id}, ${projectId}, 'Sprint 1', 'Deliver initial module', 'closed', 1, '2026-03-02T09:00:00Z', '2026-03-15T18:00:00Z', '2026-03-16T09:00:00Z', ${USERS.alice.userId}, 7, 40, '2026-03-02T09:00:00Z', '2026-03-16T09:00:00Z'),
        (${sprint2Id}, ${projectId}, 'Sprint 2', 'Deliver secondary module', 'closed', 2, '2026-03-16T09:00:00Z', '2026-03-29T18:00:00Z', '2026-03-30T09:00:00Z', ${USERS.alice.userId}, 7, 40, '2026-03-16T09:00:00Z', '2026-03-30T09:00:00Z')
    `;

    // 5. Tasks and Transitions
    console.log('Inserting 20 Tasks and their explicit transitions...');

    interface TaskDef {
      num: number;
      sprintId: string | null;
      assignee: string;
      reporter: string;
      points: number;
      finalStatus: string;
      completedAt: string | null;
      wasCompletedInSprint: boolean;
      sprintAssigned: string; // sprint1Id or sprint2Id
      transitions: Array<{ from: string | null; to: string; at: string }>;
    }

    const tasksDefs: TaskDef[] = [
      // --- SPRINT 1 TASKS ---
      {
        num: 1,
        sprintId: sprint1Id,
        assignee: USERS.alice.userId,
        reporter: USERS.alice.userId,
        points: 3,
        finalStatus: 'done',
        completedAt: '2026-03-04T10:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-02T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-02T10:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-03T10:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-04T10:00:00Z' },
        ],
      },
      {
        num: 2,
        sprintId: sprint1Id,
        assignee: USERS.alice.userId,
        reporter: USERS.alice.userId,
        points: 5,
        finalStatus: 'done',
        completedAt: '2026-03-05T12:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-02T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-02T12:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-04T12:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-05T12:00:00Z' },
        ],
      },
      {
        num: 3, // Edge Case: Skipped in_review
        sprintId: sprint1Id,
        assignee: USERS.bob.userId,
        reporter: USERS.bob.userId,
        points: 2,
        finalStatus: 'done',
        completedAt: '2026-03-04T11:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-03T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-03T11:00:00Z' },
          { from: 'in_progress', to: 'done', at: '2026-03-04T11:00:00Z' },
        ],
      },
      {
        num: 4, // Edge Case: Reopened after DONE
        sprintId: sprint1Id,
        assignee: USERS.bob.userId,
        reporter: USERS.bob.userId,
        points: 8,
        finalStatus: 'done',
        completedAt: '2026-03-09T14:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-02T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-02T14:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-04T14:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-05T14:00:00Z' },
          { from: 'done', to: 'in_progress', at: '2026-03-06T14:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-08T14:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-09T14:00:00Z' },
        ],
      },
      {
        num: 5,
        sprintId: sprint1Id,
        assignee: USERS.charlie.userId,
        reporter: USERS.charlie.userId,
        points: 1,
        finalStatus: 'done',
        completedAt: '2026-03-10T16:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-09T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-09T10:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-10T10:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-10T16:00:00Z' },
        ],
      },
      {
        num: 6,
        sprintId: sprint1Id,
        assignee: USERS.alice.userId,
        reporter: USERS.alice.userId,
        points: 3,
        finalStatus: 'done',
        completedAt: '2026-03-12T12:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-09T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-09T12:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-11T12:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-12T12:00:00Z' },
        ],
      },
      {
        num: 7, // Edge Case: Completed AFTER Sprint 1 closed
        sprintId: null, // Moved to backlog upon Sprint 1 close
        assignee: USERS.bob.userId,
        reporter: USERS.bob.userId,
        points: 5,
        finalStatus: 'done',
        completedAt: '2026-03-18T09:00:00Z',
        wasCompletedInSprint: false,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-10T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-11T09:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-14T09:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-18T09:00:00Z' },
        ],
      },
      {
        num: 8, // Edge Case: Never completed, stuck in in_review
        sprintId: null,
        assignee: USERS.charlie.userId,
        reporter: USERS.charlie.userId,
        points: 2,
        finalStatus: 'in_review',
        completedAt: null,
        wasCompletedInSprint: false,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-10T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-11T09:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-13T09:00:00Z' },
        ],
      },
      {
        num: 9, // Edge Case: Never completed, stuck in todo
        sprintId: null,
        assignee: USERS.alice.userId,
        reporter: USERS.alice.userId,
        points: 2,
        finalStatus: 'todo',
        completedAt: null,
        wasCompletedInSprint: false,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-12T09:00:00Z' },
        ],
      },
      {
        num: 10,
        sprintId: sprint1Id,
        assignee: USERS.charlie.userId,
        reporter: USERS.charlie.userId,
        points: 5,
        finalStatus: 'done',
        completedAt: '2026-03-07T15:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint1Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-04T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-04T15:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-06T15:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-07T15:00:00Z' },
        ],
      },

      // --- SPRINT 2 TASKS ---
      {
        num: 11,
        sprintId: sprint2Id,
        assignee: USERS.alice.userId,
        reporter: USERS.alice.userId,
        points: 3,
        finalStatus: 'done',
        completedAt: '2026-03-18T10:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-16T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-16T10:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-17T10:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-18T10:00:00Z' },
        ],
      },
      {
        num: 12,
        sprintId: sprint2Id,
        assignee: USERS.bob.userId,
        reporter: USERS.bob.userId,
        points: 5,
        finalStatus: 'done',
        completedAt: '2026-03-19T12:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-16T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-16T12:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-18T12:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-19T12:00:00Z' },
        ],
      },
      {
        num: 13, // Edge case: Skipped review
        sprintId: sprint2Id,
        assignee: USERS.bob.userId,
        reporter: USERS.bob.userId,
        points: 3,
        finalStatus: 'done',
        completedAt: '2026-03-19T11:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-17T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-17T11:00:00Z' },
          { from: 'in_progress', to: 'done', at: '2026-03-19T11:00:00Z' },
        ],
      },
      {
        num: 14,
        sprintId: sprint2Id,
        assignee: USERS.charlie.userId,
        reporter: USERS.charlie.userId,
        points: 8,
        finalStatus: 'done',
        completedAt: '2026-03-21T15:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-16T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-16T15:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-19T15:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-21T15:00:00Z' },
        ],
      },
      {
        num: 15,
        sprintId: sprint2Id,
        assignee: USERS.alice.userId,
        reporter: USERS.alice.userId,
        points: 2,
        finalStatus: 'done',
        completedAt: '2026-03-24T18:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-23T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-23T10:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-24T10:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-24T18:00:00Z' },
        ],
      },
      {
        num: 16,
        sprintId: sprint2Id,
        assignee: USERS.charlie.userId,
        reporter: USERS.charlie.userId,
        points: 5,
        finalStatus: 'done',
        completedAt: '2026-03-26T12:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-23T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-23T12:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-25T12:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-26T12:00:00Z' },
        ],
      },
      {
        num: 17,
        sprintId: sprint2Id,
        assignee: USERS.bob.userId,
        reporter: USERS.bob.userId,
        points: 3,
        finalStatus: 'done',
        completedAt: '2026-03-27T14:00:00Z',
        wasCompletedInSprint: true,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-23T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-23T14:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-25T14:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-03-27T14:00:00Z' },
        ],
      },
      {
        num: 18, // Edge Case: Completed after Sprint 2 closed
        sprintId: null,
        assignee: USERS.alice.userId,
        reporter: USERS.alice.userId,
        points: 1,
        finalStatus: 'done',
        completedAt: '2026-04-02T09:00:00Z',
        wasCompletedInSprint: false,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-24T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-25T09:00:00Z' },
          { from: 'in_progress', to: 'in_review', at: '2026-03-28T09:00:00Z' },
          { from: 'in_review', to: 'done', at: '2026-04-02T09:00:00Z' },
        ],
      },
      {
        num: 19, // Edge Case: Never completed, stuck in in_progress
        sprintId: null,
        assignee: USERS.bob.userId,
        reporter: USERS.bob.userId,
        points: 5,
        finalStatus: 'in_progress',
        completedAt: null,
        wasCompletedInSprint: false,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-25T09:00:00Z' },
          { from: 'todo', to: 'in_progress', at: '2026-03-26T09:00:00Z' },
        ],
      },
      {
        num: 20, // Edge Case: Never completed, stuck in todo
        sprintId: null,
        assignee: USERS.charlie.userId,
        reporter: USERS.charlie.userId,
        points: 3,
        finalStatus: 'todo',
        completedAt: null,
        wasCompletedInSprint: false,
        sprintAssigned: sprint2Id,
        transitions: [
          { from: null, to: 'todo', at: '2026-03-26T09:00:00Z' },
        ],
      },
    ];

    for (const t of tasksDefs) {
      const taskId = crypto.randomUUID();
      const taskKey = `TASK-${t.num}`;
      const firstTransitionAt = t.transitions[0].at;
      const lastTransitionAt = t.transitions[t.transitions.length - 1].at;

      // Insert Task
      await sql`
        INSERT INTO tasks (task_id, task_key, project_id, sprint_id, title, description_text, status, issue_type, priority, reporter_id, assignee_id, story_points, completed_at, created_at, updated_at)
        VALUES (${taskId}, ${taskKey}, ${projectId}, ${t.sprintId}, ${`Validation Task ${t.num}`}, 'Hand-verified task for correctness validation', ${t.finalStatus}, 'task', 'medium', ${t.reporter}, ${t.assignee}, ${t.points}, ${t.completedAt}, ${firstTransitionAt}, ${lastTransitionAt})
      `;

      // Insert Sprint-Task Link
      await sql`
        INSERT INTO sprint_tasks (id, sprint_id, task_id, was_completed_in_sprint)
        VALUES (${crypto.randomUUID()}, ${t.sprintAssigned}, ${taskId}, ${t.wasCompletedInSprint})
      `;

      // Insert Transitions
      for (const tr of t.transitions) {
        await sql`
          INSERT INTO task_status_transitions (id, task_id, project_id, from_status, to_status, actor_id, changed_at)
          VALUES (${crypto.randomUUID()}, ${taskId}, ${projectId}, ${tr.from}, ${tr.to}, ${t.assignee}, ${tr.at})
        `;
      }
    }

    // 6. Commits per user
    console.log('Inserting git commits for contributor activity...');
    const commitCounts = [
      { user: USERS.alice, count: 15 },
      { user: USERS.bob, count: 10 },
      { user: USERS.charlie, count: 5 },
    ];
    let cIndex = 1;
    for (const item of commitCounts) {
      for (let i = 0; i < item.count; i++) {
        const cDate = new Date(new Date('2026-03-02T10:00:00Z').getTime() + (cIndex * 12) * 3600000);
        await sql`
          INSERT INTO github_commits (id, project_id, commit_sha, repo_full_name, message, message_headline, author_name, author_user_id, committed_at, branch_name, created_at)
          VALUES (${crypto.randomUUID()}, ${projectId}, ${`sha_${cIndex}_${Date.now()}`}, 'correctness-org/val-repo', ${`Commit ${cIndex} by ${item.user.fullName}`}, ${`Commit ${cIndex}`}, ${item.user.fullName}, ${item.user.userId}, ${cDate}, 'main', ${cDate})
        `;
        cIndex++;
      }
    }

    // 7. Pull Requests per user
    console.log('Inserting pull requests for contributor activity...');
    const prCounts = [
      { user: USERS.alice, count: 3 },
      { user: USERS.bob, count: 2 },
      { user: USERS.charlie, count: 1 },
    ];
    let prNum = 1;
    for (const item of prCounts) {
      for (let i = 0; i < item.count; i++) {
        const prOpen = new Date(new Date('2026-03-03T10:00:00Z').getTime() + (prNum * 24) * 3600000);
        const prMerge = new Date(prOpen.getTime() + 12 * 3600000);
        await sql`
          INSERT INTO github_pull_requests (id, project_id, pr_number, title, state, head_branch, base_branch, author_user_id, author_github_login, merged_at, closed_at, created_at, updated_at)
          VALUES (${crypto.randomUUID()}, ${projectId}, ${prNum}, ${`PR ${prNum} by ${item.user.fullName}`}, 'merged', ${`feature/pr-${prNum}`}, 'main', ${item.user.userId}, ${item.user.fullName.split(' ')[0].toLowerCase()}, ${prMerge}, ${prMerge}, ${prOpen}, ${prMerge})
        `;
        prNum++;
      }
    }

    console.log('\n✓ Hand-verifiable correctness dataset successfully seeded!');
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed_correctness.ts')) {
  seedCorrectnessDataset().catch(err => {
    console.error('Fatal seed error:', err);
    process.exit(1);
  });
}
