import { getEvalSql } from './db.js';
import crypto from 'crypto';

// Fixed PRNG seed for strict reproducibility
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function rand(): number {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

const PRNG_SEED = 42;
const rand = createPrng(PRNG_SEED);

function ri(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[ri(0, arr.length - 1)];
}

function some<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = ri(0, copy.length - 1);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

const sha = () => Array.from({ length: 40 }, () => '0123456789abcdef'[ri(0, 15)]).join('');

const PASSWORD_HASH = '$2b$10$CEqoBuXmKeVur02/5KkPKutdV50UvRfpVjFuUlkBc5M04gsEWmcZq'; // Password123!

interface SeedConfig {
  name: string;
  slug: string;
  projectKey: string;
  projectName: string;
  taskCount: number;
  sprintCount: number;
  transitionCount: number;
  commitCount: number;
  prCount: number;
  ciCount: number;
}

export const DATASET_CONFIGS: Record<'small' | 'medium' | 'large', SeedConfig> = {
  small: {
    name: 'Eval Small Workspace',
    slug: 'eval-ws-small',
    projectKey: 'SM',
    projectName: 'Small Scale Project',
    taskCount: 200,
    sprintCount: 5,
    transitionCount: 1000,
    commitCount: 500,
    prCount: 50,
    ciCount: 200,
  },
  medium: {
    name: 'Eval Medium Workspace',
    slug: 'eval-ws-medium',
    projectKey: 'MD',
    projectName: 'Medium Scale Project',
    taskCount: 2000,
    sprintCount: 20,
    transitionCount: 10000,
    commitCount: 3000,
    prCount: 300,
    ciCount: 1500,
  },
  large: {
    name: 'Eval Large Workspace',
    slug: 'eval-ws-large',
    projectKey: 'LG',
    projectName: 'Large Scale Project',
    taskCount: 20000,
    sprintCount: 50,
    transitionCount: 100000,
    commitCount: 15000,
    prCount: 1500,
    ciCount: 5000,
  },
};

async function batchInsert(sql: any, table: string, rows: any[], chunkSize = 1000) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await sql`INSERT INTO ${sql(table)} ${sql(chunk)}`;
  }
}

export async function seedAll() {
  const sql = getEvalSql(10);
  console.log('=== Starting DevSync Evaluation Seed (Fixed Seed: 42) ===\n');

  try {
    // 1. Clean existing evaluation workspaces & test users
    console.log('Cleaning up previous eval data...');
    await sql`DELETE FROM workspaces WHERE slug LIKE 'eval-ws-%'`;
    await sql`DELETE FROM users WHERE email LIKE 'eval_user_%@devsync.eval'`;

    // 2. Seed 10 Users
    console.log('Seeding 10 evaluation users...');
    const usersList: { userId: string; email: string; fullName: string }[] = [];
    for (let i = 1; i <= 10; i++) {
      const userId = crypto.randomUUID();
      const email = `eval_user_${i}@devsync.eval`;
      const fullName = `Eval User ${i}`;
      usersList.push({ userId, email, fullName });
    }

    const userRows = usersList.map((u, i) => ({
      user_id: u.userId,
      email: u.email,
      full_name: u.fullName,
      display_name: `eval${i + 1}`,
      password_hash: PASSWORD_HASH,
      presence: 'offline',
      email_verified_at: new Date('2026-01-01T00:00:00Z'),
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
    }));
    await batchInsert(sql, 'users', userRows);

    const now = new Date();
    const WINDOW_DAYS = 90;
    const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86400000);

    // 3. Seed Each Dataset Size (Small, Medium, Large)
    for (const [sizeKey, cfg] of Object.entries(DATASET_CONFIGS)) {
      const t0 = performance.now();
      console.log(`\n--- Seeding [${sizeKey.toUpperCase()}] Dataset ---`);
      console.log(`Tasks: ${cfg.taskCount}, Sprints: ${cfg.sprintCount}, Transitions: ${cfg.transitionCount}, Commits: ${cfg.commitCount}, PRs: ${cfg.prCount}, CI: ${cfg.ciCount}`);

      // Create Workspace
      const workspaceId = crypto.randomUUID();
      await sql`
        INSERT INTO workspaces (workspace_id, name, slug, owner_id, created_at, updated_at)
        VALUES (${workspaceId}, ${cfg.name}, ${cfg.slug}, ${usersList[0].userId}, ${windowStart}, ${now})
      `;

      // Workspace Members
      const wsMemberRows = usersList.map((u, idx) => ({
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        user_id: u.userId,
        role: idx === 0 ? 'owner' : idx <= 2 ? 'admin' : 'member',
        state: 'active',
        joined_at: windowStart,
      }));
      await batchInsert(sql, 'workspace_members', wsMemberRows);

      // Create Project
      const projectId = crypto.randomUUID();
      await sql`
        INSERT INTO projects (project_id, workspace_id, key, name, description, status, issue_counter, created_at, updated_at)
        VALUES (${projectId}, ${workspaceId}, ${cfg.projectKey}, ${cfg.projectName}, ${'Benchmark test project'}, 'active', ${cfg.taskCount}, ${windowStart}, ${now})
      `;

      // Project Members
      const projMemberRows = usersList.map((u, idx) => ({
        id: crypto.randomUUID(),
        project_id: projectId,
        user_id: u.userId,
        role: idx === 0 ? 'project_admin' : 'developer',
        added_at: windowStart,
      }));
      await batchInsert(sql, 'project_members', projMemberRows);

      // General Channel for workspace and project
      const channelId = crypto.randomUUID();
      await sql`
        INSERT INTO channels (channel_id, workspace_id, project_id, name, slug, description, type, is_default, created_at)
        VALUES (${channelId}, ${workspaceId}, ${projectId}, 'general', ${`${cfg.slug}-general`}, 'General channel for benchmarking', 'public', true, ${windowStart})
      `;

      // 4. Sprints
      const sprintDays = Math.max(7, Math.floor(WINDOW_DAYS / cfg.sprintCount));
      const sprints: { sprintId: string; name: string; seq: number; startDate: Date; endDate: Date; status: string }[] = [];
      for (let s = 1; s <= cfg.sprintCount; s++) {
        const sprintId = crypto.randomUUID();
        const startOffsetDays = WINDOW_DAYS - (cfg.sprintCount - s + 1) * sprintDays;
        const sStart = new Date(windowStart.getTime() + startOffsetDays * 86400000);
        const sEnd = new Date(sStart.getTime() + sprintDays * 86400000);
        const isActive = s === cfg.sprintCount;

        sprints.push({
          sprintId,
          name: `${cfg.projectKey} Sprint ${s}`,
          seq: s,
          startDate: sStart,
          endDate: sEnd,
          status: isActive ? 'active' : 'closed',
        });
      }

      const sprintRows = sprints.map(s => ({
        sprint_id: s.sprintId,
        project_id: projectId,
        name: s.name,
        goal: `Sprint ${s.seq} target delivery`,
        status: s.status,
        start_date: s.startDate,
        end_date: s.endDate,
        closed_at: s.status === 'closed' ? s.endDate : null,
        closed_by: s.status === 'closed' ? usersList[0].userId : null,
        velocity_issues: s.status === 'closed' ? Math.floor(cfg.taskCount / cfg.sprintCount) : null,
        capacity_points: ri(30, 80),
        sequence_number: s.seq,
        created_at: s.startDate,
        updated_at: s.status === 'closed' ? s.endDate : now,
      }));
      await batchInsert(sql, 'sprints', sprintRows);

      // 5. Tasks & Transitions Generation
      // Distribute transitionCount across taskCount
      // Every task gets at least 1 transition (null -> todo).
      // Remaining (transitionCount - taskCount) transitions are distributed among tasks.
      const extraTransitionsNeeded = cfg.transitionCount - cfg.taskCount;
      const extraPerTask = new Array(cfg.taskCount).fill(0);
      for (let i = 0; i < extraTransitionsNeeded; i++) {
        extraPerTask[i % cfg.taskCount]++;
      }

      const taskRows: any[] = [];
      const transitionRows: any[] = [];
      const sprintTaskRows: any[] = [];
      const auditRows: any[] = [];

      for (let t = 0; t < cfg.taskCount; t++) {
        const taskId = crypto.randomUUID();
        const taskNum = t + 1;
        const taskKey = `${cfg.projectKey}-${taskNum}`;
        const assignee = pick(usersList);
        const reporter = pick(usersList);
        const sprint = sprints[t % sprints.length];
        const points = pick([1, 2, 3, 5, 8]);

        // Base creation time within the 90 day window
        const taskCreatedOffset = (t / cfg.taskCount) * (WINDOW_DAYS - 10);
        const tCreate = new Date(windowStart.getTime() + taskCreatedOffset * 86400000 + ri(1000, 3600000));

        // Generate the exact sequence of transitions for this task
        const numExtra = extraPerTask[t];
        const stages: Array<{ from: string | null; to: string }> = [{ from: null, to: 'todo' }];

        // State progression options
        let currentStatus = 'todo';
        for (let step = 0; step < numExtra; step++) {
          if (currentStatus === 'todo') {
            stages.push({ from: 'todo', to: 'in_progress' });
            currentStatus = 'in_progress';
          } else if (currentStatus === 'in_progress') {
            stages.push({ from: 'in_progress', to: 'in_review' });
            currentStatus = 'in_review';
          } else if (currentStatus === 'in_review') {
            if (step === numExtra - 1) {
              stages.push({ from: 'in_review', to: 'done' });
              currentStatus = 'done';
            } else {
              // Rework loop
              stages.push({ from: 'in_review', to: 'in_progress' });
              currentStatus = 'in_progress';
            }
          } else {
            // Done -> in_review or in_progress (reopened)
            stages.push({ from: 'done', to: 'in_progress' });
            currentStatus = 'in_progress';
          }
        }

        // Assign timestamps with realistic dwell times (hours)
        let curTime = tCreate;
        let completedAt: Date | null = null;
        for (let idx = 0; idx < stages.length; idx++) {
          const st = stages[idx];
          if (idx > 0) {
            // Add dwell time: 2 to 36 hours
            curTime = new Date(curTime.getTime() + ri(2, 36) * 3600000);
            if (curTime > now) curTime = new Date(now.getTime() - ri(60, 3600) * 1000);
          }
          if (st.to === 'done') {
            completedAt = curTime;
          }

          transitionRows.push({
            id: crypto.randomUUID(),
            task_id: taskId,
            project_id: projectId,
            from_status: st.from,
            to_status: st.to,
            actor_id: assignee.userId,
            changed_at: curTime,
          });
        }

        const finalStatus = stages[stages.length - 1].to;

        taskRows.push({
          task_id: taskId,
          task_key: taskKey,
          project_id: projectId,
          sprint_id: sprint.sprintId,
          title: `Implement feature module ${taskNum} for ${cfg.projectKey}`,
          description_text: `Automated test benchmark task description for ${taskKey}`,
          issue_type: pick(['task', 'story', 'bug']),
          status: finalStatus,
          priority: pick(['low', 'medium', 'high', 'critical']),
          reporter_id: reporter.userId,
          assignee_id: assignee.userId,
          story_points: points,
          rank: `0|h${String(t).padStart(6, '0')}:`,
          completed_at: completedAt,
          created_at: tCreate,
          updated_at: curTime,
        });

        // Sprint Task Junction
        sprintTaskRows.push({
          id: crypto.randomUUID(),
          sprint_id: sprint.sprintId,
          task_id: taskId,
          was_completed_in_sprint: finalStatus === 'done',
        });

        // Audit Log entry
        auditRows.push({
          log_id: crypto.randomUUID(),
          workspace_id: workspaceId,
          actor_id: reporter.userId,
          action: 'task.created',
          entity_type: 'task',
          entity_id: taskId,
          new_values: { taskKey, title: `Implement feature module ${taskNum}` },
          created_at: tCreate,
        });
      }

      console.log(`Inserting ${taskRows.length} tasks...`);
      await batchInsert(sql, 'tasks', taskRows);

      console.log(`Inserting ${transitionRows.length} status transitions...`);
      await batchInsert(sql, 'task_status_transitions', transitionRows);

      console.log(`Inserting ${sprintTaskRows.length} sprint_tasks junction rows...`);
      await batchInsert(sql, 'sprint_tasks', sprintTaskRows);

      console.log(`Inserting ${auditRows.length} audit logs...`);
      await batchInsert(sql, 'audit_logs', auditRows);

      // 6. Commits
      console.log(`Inserting ${cfg.commitCount} git commits...`);
      const commitRows: any[] = [];
      for (let c = 0; c < cfg.commitCount; c++) {
        const author = pick(usersList);
        const task = taskRows[c % taskRows.length];
        const cDate = new Date(windowStart.getTime() + (c / cfg.commitCount) * WINDOW_DAYS * 86400000 + ri(100, 3600000));
        commitRows.push({
          id: crypto.randomUUID(),
          project_id: projectId,
          task_id: task.task_id,
          commit_sha: sha(),
          repo_full_name: `eval-org/${cfg.slug}-repo`,
          message: `feat(${cfg.projectKey}): commit ${c + 1} ref [${task.task_key}]`,
          message_headline: `commit ${c + 1} for ${task.task_key}`,
          author_name: author.fullName,
          author_github_login: `user_${author.userId.slice(0, 5)}`,
          author_user_id: author.userId,
          committed_at: cDate,
          branch_name: 'main',
          url: `https://github.com/eval-org/${cfg.slug}-repo/commit/${c}`,
          created_at: cDate,
        });
      }
      await batchInsert(sql, 'github_commits', commitRows);

      // 7. Pull Requests
      console.log(`Inserting ${cfg.prCount} pull requests...`);
      const prRows: any[] = [];
      for (let p = 1; p <= cfg.prCount; p++) {
        const author = pick(usersList);
        const task = taskRows[p % taskRows.length];
        const openedAt = new Date(windowStart.getTime() + (p / cfg.prCount) * WINDOW_DAYS * 86400000);
        const isMerged = p <= Math.floor(cfg.prCount * 0.8);
        const mergedAt = isMerged ? new Date(openedAt.getTime() + ri(4, 48) * 3600000) : null;

        prRows.push({
          id: crypto.randomUUID(),
          project_id: projectId,
          task_id: task.task_id,
          pr_number: p,
          title: `PR ${p}: resolve ${task.task_key} logic`,
          body: `Resolves ${task.task_key}`,
          state: isMerged ? 'merged' : 'open',
          html_url: `https://github.com/eval-org/${cfg.slug}-repo/pull/${p}`,
          head_branch: `feature/${cfg.projectKey}-${p}`,
          base_branch: 'main',
          author_github_login: `user_${author.userId.slice(0, 5)}`,
          author_user_id: author.userId,
          merged_at: mergedAt,
          closed_at: mergedAt,
          created_at: openedAt,
          updated_at: mergedAt ?? openedAt,
        });
      }
      await batchInsert(sql, 'github_pull_requests', prRows);

      // 8. CI Status Runs
      console.log(`Inserting ${cfg.ciCount} CI workflow runs...`);
      const ciRows: any[] = [];
      let baseRunId = 1000000 + (sizeKey === 'small' ? 10000 : sizeKey === 'medium' ? 50000 : 100000);
      for (let r = 0; r < cfg.ciCount; r++) {
        const trigAt = new Date(windowStart.getTime() + (r / cfg.ciCount) * WINDOW_DAYS * 86400000);
        const durationSec = ri(45, 600);
        const compAt = new Date(trigAt.getTime() + durationSec * 1000);
        const isSuccess = rand() < 0.85;

        ciRows.push({
          id: crypto.randomUUID(),
          project_id: projectId,
          workflow_name: pick(['build-and-test', 'ci-checks', 'deploy-preview']),
          run_id: baseRunId + r,
          status: 'completed',
          conclusion: isSuccess ? 'success' : 'failure',
          head_branch: 'main',
          head_sha: sha(),
          html_url: `https://github.com/eval-org/${cfg.slug}-repo/actions/runs/${baseRunId + r}`,
          triggered_at: trigAt,
          completed_at: compAt,
          created_at: compAt,
        });
      }
      await batchInsert(sql, 'github_ci_status', ciRows);

      const elapsedSec = ((performance.now() - t0) / 1000).toFixed(1);
      console.log(`✓ Completed [${sizeKey.toUpperCase()}] in ${elapsedSec}s`);
    }

    // Verify row counts in database
    console.log('\n=== Verification of Seeded Data in devsync_eval ===');
    for (const [sizeKey, cfg] of Object.entries(DATASET_CONFIGS)) {
      const [counts] = await sql`
        SELECT
          (SELECT count(*)::int FROM tasks t JOIN projects p ON t.project_id = p.project_id WHERE p.key = ${cfg.projectKey}) as tasks,
          (SELECT count(*)::int FROM task_status_transitions tr JOIN projects p ON tr.project_id = p.project_id WHERE p.key = ${cfg.projectKey}) as transitions,
          (SELECT count(*)::int FROM sprints sp JOIN projects p ON sp.project_id = p.project_id WHERE p.key = ${cfg.projectKey}) as sprints,
          (SELECT count(*)::int FROM github_commits c JOIN projects p ON c.project_id = p.project_id WHERE p.key = ${cfg.projectKey}) as commits,
          (SELECT count(*)::int FROM github_pull_requests pr JOIN projects p ON pr.project_id = p.project_id WHERE p.key = ${cfg.projectKey}) as prs,
          (SELECT count(*)::int FROM github_ci_status ci JOIN projects p ON ci.project_id = p.project_id WHERE p.key = ${cfg.projectKey}) as ci
      `;
      console.log(`[${sizeKey.toUpperCase()}]:`, counts);
    }

    console.log('\n✓ Seeding finished successfully and verified!');
  } finally {
    await sql.end();
  }
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedAll().catch(err => {
    console.error('Fatal seed error:', err);
    process.exit(1);
  });
}
