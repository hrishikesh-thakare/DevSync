/**
 * DevSync — aged demo workspace seed
 *
 * Builds a self-contained workspace with roughly six months of realistic
 * history, exercising every surface the app renders: projects, boards, sprints,
 * analytics, channels, threads, reactions, labels, GitHub integration,
 * notifications and the audit trail.
 *
 * Writes directly to Postgres (DATABASE_URL from backend/.env — the Supabase
 * connection). This is deliberate: created_at, changed_at and completed_at are
 * all set server-side by the API, so history cannot be backdated through it.
 *
 * Safe to re-run — it drops its own workspace first and the FK cascades take
 * everything with it. It never touches the e2e workspace the test suite
 * asserts against.
 *
 * Run: npx tsx src/db/seed-demo-workspace.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const WS_NAME = 'Northwind Labs';
const WS_SLUG = 'northwind-labs';
const PASSWORD = 'Password123!';
/** Existing account made owner, so the demo shows up for whoever already signs in. */
const OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL || 'alice@demo.com';

const HISTORY_DAYS = 182;
const SPRINT_DAYS = 14;

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const addHours = (d: Date, n: number) => new Date(d.getTime() + n * 3_600_000);
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const skipWeekend = (d: Date) => {
  let o = d;
  while (isWeekend(o)) o = addHours(o, 12);
  return o;
};

// Deterministic PRNG so re-running reproduces the same demo.
let s = 0x9e3779b9;
const rand = () => {
  s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
  return ((s >>> 0) % 1_000_000) / 1_000_000;
};
const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(x: readonly T[]): T => x[ri(0, x.length - 1)];
const some = <T>(x: readonly T[], n: number): T[] => [...x].sort(() => rand() - 0.5).slice(0, n);
/** Long tail: most things are quick, a few drag badly. */
const skew = (min: number, max: number) => min + (max - min) * rand() * rand();
const sha = () => Array.from({ length: 40 }, () => '0123456789abcdef'[ri(0, 15)]).join('');

const TEAM = [
  ['Priya Raman', 'priya@northwind.dev', 'admin'],
  ['Marcus Webb', 'marcus@northwind.dev', 'admin'],
  ['Lena Fischer', 'lena@northwind.dev', 'member'],
  ['Tom Okafor', 'tom@northwind.dev', 'member'],
  ['Sofia Marchetti', 'sofia@northwind.dev', 'member'],
  ['Rahul Desai', 'rahul@northwind.dev', 'member'],
  ['Chen Wei', 'chen@northwind.dev', 'member'],
  ['Amara Diallo', 'amara@northwind.dev', 'member'],
  ['Jonas Berg', 'jonas@northwind.dev', 'member'],
  ['Nadia Haddad', 'nadia@northwind.dev', 'member'],
] as const;

const PROJECTS = [
  { key: 'PLAT', name: 'Platform Core', desc: 'API, auth, and the data layer.', repo: 'northwind/platform', weight: 0.42 },
  { key: 'WEB', name: 'Web Client', desc: 'The React front end.', repo: 'northwind/web', weight: 0.31 },
  { key: 'MOB', name: 'Mobile App', desc: 'React Native client for iOS and Android.', repo: 'northwind/mobile', weight: 0.19 },
  { key: 'DS', name: 'Design System', desc: 'Shared component library and tokens.', repo: 'northwind/design-system', weight: 0.08 },
];

const LABELS = [
  ['backend', '#2563eb'], ['frontend', '#7c3aed'], ['bug', '#dc2626'],
  ['tech-debt', '#a16207'], ['performance', '#059669'], ['security', '#be123c'],
  ['ux', '#db2777'], ['docs', '#475569'],
] as const;

const TITLES: Record<string, string[]> = {
  bug: [
    'Refresh token rotation races on parallel requests',
    'Board drag drops the card into the wrong column',
    'Sprint burndown is off by one on the final day',
    'Unread badge does not clear when opening a channel',
    'Search snippet double-escapes HTML entities',
    'Webhook signature check rejects valid payloads',
    'Avatar initials show "?" when the assignee join is missing',
    'Timezone drift on due-date comparison',
    'Memory leak in the socket reconnect loop',
    'Rate limiter counts proxied IPs as one client',
  ],
  task: [
    'Add cycle-time aggregation query',
    'Paginate the notification inbox',
    'Cache workspace membership lookups',
    'Index audit_logs by workspace and date',
    'Move AI calls onto the background queue',
    'Backfill github_login for existing accounts',
    'Extract the percent-complete helper',
    'Add optimistic updates to the board',
    'Compress avatar uploads on ingest',
    'Split the vendor bundle',
    'Add structured logging to the webhook path',
    'Retry failed invite emails with backoff',
  ],
  story: [
    'Team lead can see workload across the sprint',
    'Developer can jump to any task from the palette',
    'Owner can review and revoke pending invitations',
    'Member can filter their tasks by status',
    'Reviewer sees CI status inline on the board',
    'Anyone can search messages and tasks together',
  ],
  epic: ['Delivery analytics', 'GitHub integration depth', 'Notification overhaul', 'Mobile parity'],
  subtask: ['Write the migration', 'Add e2e coverage', 'Update the docs', 'Wire the UI', 'Review and merge'],
};

const CHAT = [
  'Pushed a fix for that, can someone take a look?',
  'CI is green on my branch now.',
  'I think this is a duplicate of the one from last sprint.',
  'Nice, that shaved about 200ms off the board render.',
  'Do we want this behind a flag first?',
  'Merged. Thanks for the quick review.',
  'Heads up, the staging DB is being migrated at 4pm.',
  'I can pick this up tomorrow morning.',
  'Blocked on the design token rename, ping me when it lands.',
  'That regression came from the ranking change, reverting.',
  'Numbers look much healthier this week.',
  'Can we split this? It is getting big for one PR.',
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
  const now = new Date();
  const start = addDays(now, -HISTORY_DAYS);

  try {
    // ── Users ───────────────────────────────────────────────────────────────
    const [owner] = await sql`
      SELECT user_id, full_name FROM users WHERE email = ${OWNER_EMAIL} AND deleted_at IS NULL LIMIT 1
    `;
    if (!owner) throw new Error(`Owner ${OWNER_EMAIL} not found — run the e2e seed first.`);

    const hash = await bcrypt.hash(PASSWORD, 10);
    const people: { userId: string; name: string; role: string }[] = [
      { userId: owner.user_id as string, name: owner.full_name as string, role: 'owner' },
    ];

    for (const [name, email, role] of TEAM) {
      const [existing] = await sql`SELECT user_id FROM users WHERE email = ${email} LIMIT 1`;
      let id: string;
      if (existing) {
        id = existing.user_id as string;
      } else {
        id = randomUUID();
        await sql`
          INSERT INTO users (user_id, email, full_name, password_hash, email_verified_at, presence, github_login, created_at)
          VALUES (${id}, ${email}, ${name}, ${hash}, ${start}, ${pick(['online', 'offline', 'away'])},
                  ${email.split('@')[0]}, ${start})
        `;
      }
      people.push({ userId: id, name, role: role as string });
    }
    const devs = people.slice(1);
    console.log(`users: ${people.length} (owner ${OWNER_EMAIL} + ${TEAM.length} teammates)`);

    // ── Workspace ───────────────────────────────────────────────────────────
    await sql`DELETE FROM workspaces WHERE slug = ${WS_SLUG}`;
    const wsId = randomUUID();
    await sql`
      INSERT INTO workspaces (workspace_id, name, slug, description, owner_id, created_at, updated_at)
      VALUES (${wsId}, ${WS_NAME}, ${WS_SLUG},
              ${'Product engineering at Northwind. Six months of generated history.'},
              ${people[0].userId}, ${start}, ${now})
    `;
    await sql`
      INSERT INTO workspace_members ${sql(
        people.map((p) => ({
          workspace_id: wsId, user_id: p.userId, role: p.role,
          invited_by: people[0].userId, state: 'active', joined_at: start,
        })),
      )}
    `;

    // Pending invitations, so the dashboard card has something to show.
    await sql`
      INSERT INTO workspace_invites ${sql(
        ['erin@northwind.dev', 'kofi@northwind.dev'].map((email, i) => ({
          workspace_id: wsId, email, role: 'member', token: randomUUID(),
          invited_by: people[0].userId, created_at: addDays(now, -3 - i),
          expires_at: addDays(now, 4 - i),
        })),
      )}
    `;
    console.log(`workspace: ${WS_SLUG} · ${people.length} members · 2 pending invites`);

    // ── Channels ────────────────────────────────────────────────────────────
    const channels: { id: string; name: string; projectId: string | null }[] = [];
    const mkChannel = async (
      name: string, type: string, projectId: string | null,
      opts: { isDefault?: boolean; announcement?: boolean; memberIds?: string[] } = {},
    ) => {
      const id = randomUUID();
      await sql`
        INSERT INTO channels (channel_id, workspace_id, project_id, name, slug, description, type, is_default, is_announcement_only, created_by, created_at)
        VALUES (${id}, ${wsId}, ${projectId}, ${name}, ${name}, ${`#${name}`}, ${type},
                ${opts.isDefault ?? false}, ${opts.announcement ?? false}, ${people[0].userId}, ${start})
      `;
      const memberIds = opts.memberIds ?? people.map((p) => p.userId);
      await sql`
        INSERT INTO channel_members ${sql(
          memberIds.map((uid) => ({ channel_id: id, user_id: uid, joined_at: start })),
        )}
      `;
      channels.push({ id, name, projectId });
      return id;
    };

    const generalId = await mkChannel('general', 'public', null, { isDefault: true });
    await mkChannel('announcements', 'public', null, { announcement: true });
    await mkChannel('random', 'public', null);
    await mkChannel('leads-private', 'private', null, {
      memberIds: people.filter((p) => p.role !== 'member').map((p) => p.userId),
    });
    await mkChannel('dm', 'dm', null, { memberIds: [people[0].userId, devs[0].userId] });

    // ── Projects ────────────────────────────────────────────────────────────
    const allTasks: any[] = [];
    const allTransitions: any[] = [];
    const allMessages: any[] = [];
    const allReactions: any[] = [];
    const allAudit: any[] = [];
    const allNotifications: any[] = [];
    // Collected across projects and written after `tasks`, since the FK needs
    // the task rows to exist first.
    const allSprintLinks: any[] = [];
    let totalSprints = 0;
    let taskSeq = 0;

    for (const p of PROJECTS) {
      const projectId = randomUUID();
      const archived = p.key === 'DS' && false;
      const projLead = pick(devs);
      const projMembers = [people[0], ...some(devs, ri(4, 7))];

      await sql`
        INSERT INTO projects (project_id, workspace_id, name, key, description, lead_user_id, github_repo_owner, github_repo_name, issue_counter, status, created_at, updated_at)
        VALUES (${projectId}, ${wsId}, ${p.name}, ${p.key}, ${p.desc}, ${projLead.userId},
                ${p.repo.split('/')[0]}, ${p.repo.split('/')[1]}, 0, ${archived ? 'archived' : 'active'}, ${start}, ${now})
      `;
      await sql`
        INSERT INTO project_members ${sql(
          projMembers.map((m, i) => ({
            project_id: projectId, user_id: m.userId,
            role: i === 0 ? 'project_admin' : i === 1 ? 'project_admin' : rand() < 0.85 ? 'developer' : 'viewer',
            added_by: people[0].userId, added_at: start,
          })),
        )}
      `;

      const labelRows = some(LABELS, ri(5, 8)).map(([name, color]) => ({
        label_id: randomUUID(), project_id: projectId, name, color, created_at: start, updated_at: start,
      }));
      await sql`INSERT INTO project_labels ${sql(labelRows)}`;
      const labelNames = labelRows.map((l) => l.name);

      const projChannelId = await mkChannel(`${p.key.toLowerCase()}-dev`, 'public', projectId, {
        memberIds: projMembers.map((m) => m.userId),
      });

      // GitHub connection
      await sql`
        INSERT INTO github_connections (project_id, connected_by, github_repo_full_name, github_repo_id, default_branch, created_at)
        VALUES (${projectId}, ${people[0].userId}, ${p.repo}, ${ri(100000, 999999)}, 'main', ${start})
      `;

      // ── Sprints ───────────────────────────────────────────────────────────
      const sprintCount = Math.max(3, Math.round(HISTORY_DAYS / SPRINT_DAYS));
      const sprints: { id: string; start: Date; end: Date; active: boolean }[] = [];
      for (let i = 0; i < sprintCount; i++) {
        const sStart = addDays(now, -(sprintCount - i) * SPRINT_DAYS + 7);
        const sEnd = addDays(sStart, SPRINT_DAYS);
        const active = i === sprintCount - 1;
        const id = randomUUID();
        sprints.push({ id, start: sStart, end: sEnd, active });
        totalSprints++;

        // Closed sprints carry an AI retrospective, so the sprint page has one
        // to render — the columns exist but nothing had ever populated them.
        const contributors = some(projMembers, 3);
        const aiSummary = active ? null : {
          summary: `The team closed out ${ri(6, 14)} issues, with most of the effort going into ${pick(['the review backlog', 'performance work', 'bug triage', 'the migration'])}. Review latency was the main drag on flow.`,
          highlights: [
            `Completed ${ri(6, 14)} of ${ri(14, 20)} tasks`,
            pick(['Cut median review time by roughly a day', 'Cleared the oldest three bugs in the backlog', 'Shipped the analytics endpoint ahead of schedule']),
            pick(['Two tasks carried over to the next sprint', 'CI stability improved late in the sprint']),
          ],
          generatedAt: sEnd.toISOString(),
        };
        const aiContrib = active ? null : contributors.map((c) => ({
          userId: c.userId, fullName: c.name,
          summary: pick([`Led the ${pick(['migration', 'refactor', 'review effort'])} and unblocked two others.`, 'Steady throughput across bugs and features.', 'Focused on review and CI stability.']),
          tasksCompleted: ri(2, 6),
        }));

        await sql`
          INSERT INTO sprints (sprint_id, project_id, name, goal, status, start_date, end_date, closed_at, closed_by, velocity_issues, capacity_points, sequence_number, ai_summary, ai_contribution_report, created_at, updated_at)
          VALUES (${id}, ${projectId}, ${`${p.key} Sprint ${i + 1}`},
                  ${pick(['Ship the analytics foundation', 'Reduce review latency', 'Harden the webhook path', 'Cut cycle time on bugs', 'Close out the notification epic'])},
                  ${active ? 'active' : 'closed'}, ${sStart}, ${sEnd},
                  ${active ? null : sEnd}, ${active ? null : people[0].userId},
                  ${active ? null : ri(5, 14)}, ${ri(28, 46)}, ${i + 1},
                  ${active ? null : sql.json(aiSummary as any)},
                  ${active ? null : sql.json(aiContrib as any)},
                  ${sStart}, ${active ? now : sEnd})
        `;
      }

      // ── Tasks ─────────────────────────────────────────────────────────────
      const taskTarget = Math.round(420 * p.weight);
      const epics: string[] = [];

      for (let n = 1; n <= taskTarget; n++) {
        taskSeq++;
        const roll = rand();
        const issueType = roll < 0.03 ? 'epic' : roll < 0.16 ? 'story' : roll < 0.4 ? 'bug' : roll < 0.9 ? 'task' : 'subtask';
        const createdAt = skipWeekend(addDays(start, rand() * HISTORY_DAYS));

        // Dwell times in hours. Waiting to be picked up dominates; review is
        // usually fast but occasionally stalls badly.
        const startedAt = skipWeekend(addHours(createdAt, skew(2, 20 * 24)));
        const reviewAt = skipWeekend(addHours(startedAt, skew(3, 8 * 24)));
        const doneAt = skipWeekend(addHours(reviewAt, skew(1, 4 * 24)));

        let stage: string;
        const r2 = rand();
        if (r2 < 0.7) stage = 'done';
        else if (r2 < 0.81) stage = 'in_review';
        else if (r2 < 0.92) stage = 'in_progress';
        else stage = 'todo';

        if (stage === 'done' && doneAt > now) stage = reviewAt <= now ? 'in_review' : startedAt <= now ? 'in_progress' : 'todo';
        if (stage === 'in_review' && reviewAt > now) stage = startedAt <= now ? 'in_progress' : 'todo';
        if (stage === 'in_progress' && startedAt > now) stage = 'todo';

        const assignee = pick(projMembers);
        const reporter = pick(projMembers);
        const taskId = randomUUID();
        const completedAt = stage === 'done' ? doneAt : null;
        const anchor = completedAt ?? startedAt;
        const sprint = sprints.find((sp) => anchor >= sp.start && anchor < sp.end);
        const epicId = issueType !== 'epic' && epics.length && rand() < 0.35 ? pick(epics) : null;
        if (issueType === 'epic') epics.push(taskId);

        allTasks.push({
          task_id: taskId, task_key: `${p.key}-${n}`, project_id: projectId,
          epic_id: epicId, sprint_id: sprint?.id ?? null,
          title: pick(TITLES[issueType]), description: {}, description_text: '',
          issue_type: issueType, status: stage,
          priority: pick(['critical', 'high', 'medium', 'medium', 'medium', 'low']),
          reporter_id: reporter.userId, assignee_id: rand() < 0.9 ? assignee.userId : null,
          due_date: rand() < 0.35 ? addDays(createdAt, ri(3, 30)) : null,
          // `tasks.labels` is jsonb — `postgres` already serializes a plain
          // JS array into it correctly. Passing a pre-stringified string here
          // instead makes the driver serialize *that*, producing a jsonb
          // scalar string whose text content merely looks like an array
          // (`"[\"backend\"]"`, not `["backend"]`). Every reader that expects
          // a real array — `jsonb_array_elements(tasks.labels)` in
          // `labels.controller.ts` chief among them — throws on a scalar,
          // which is exactly the 500 that shipped with this bug.
          labels: some(labelNames, ri(0, 2)),
          rank: `a${String(taskSeq).padStart(6, '0')}`,
          story_points: issueType === 'epic' ? null : pick([1, 2, 2, 3, 3, 5, 5, 8, 13]),
          linked_commits_count: stage === 'done' ? ri(0, 4) : 0,
          completed_at: completedAt,
          created_at: createdAt,
          updated_at: completedAt ?? reviewAt,
        });

        allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: null, to_status: 'todo', actor_id: reporter.userId, changed_at: createdAt });
        if (stage !== 'todo') allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: 'todo', to_status: 'in_progress', actor_id: assignee.userId, changed_at: startedAt });
        if (stage === 'in_review' || stage === 'done') allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: 'in_progress', to_status: 'in_review', actor_id: assignee.userId, changed_at: reviewAt });
        if (stage === 'done') allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: 'in_review', to_status: 'done', actor_id: assignee.userId, changed_at: doneAt });

        if (sprint) allSprintLinks.push({ sprint_id: sprint.id, task_id: taskId, was_completed_in_sprint: stage === 'done' });

        allAudit.push({
          log_id: randomUUID(), actor_id: reporter.userId, action: 'task.created',
          entity_type: 'task', entity_id: taskId, workspace_id: wsId,
          old_values: null,
          // Same jsonb double-encoding bug as `tasks.labels` above — `postgres`
          // serializes a plain JS object into jsonb correctly on its own.
          new_values: { task_key: `${p.key}-${n}`, title: 'seeded', status: 'todo', project_id: projectId },
          created_at: createdAt,
        });
        if (stage === 'done') {
          allAudit.push({
            log_id: randomUUID(), actor_id: assignee.userId, action: 'task.status_changed',
            entity_type: 'task', entity_id: taskId, workspace_id: wsId,
            old_values: { status: 'in_review' },
            new_values: { status: 'done' },
            created_at: doneAt,
          });
        }
      }

      await sql`UPDATE projects SET issue_counter = ${taskTarget} WHERE project_id = ${projectId}`;

      // ── Channel conversation for this project ─────────────────────────────
      for (let i = 0; i < 45; i++) {
        const at = skipWeekend(addDays(start, rand() * HISTORY_DAYS));
        if (at > now) continue;
        const author = pick(projMembers);
        const rootId = randomUUID();
        const replies = rand() < 0.35 ? ri(1, 4) : 0;
        allMessages.push({
          message_id: rootId, channel_id: projChannelId, author_id: author.userId,
          is_system: false, system_type: null, body_text: pick(CHAT), body_blocks: null,
          thread_id: null, reply_count: replies, is_pinned: rand() < 0.05,
          created_at: at, updated_at: at,
        });
        for (let r = 0; r < replies; r++) {
          const rAt = addHours(at, (r + 1) * skew(0.2, 6));
          if (rAt > now) continue;
          allMessages.push({
            message_id: randomUUID(), channel_id: projChannelId, author_id: pick(projMembers).userId,
            is_system: false, system_type: null, body_text: pick(CHAT), body_blocks: null,
            thread_id: rootId, reply_count: 0, is_pinned: false,
            created_at: rAt, updated_at: rAt,
          });
        }
        if (rand() < 0.3) {
          for (const u of some(projMembers, ri(1, 3))) {
            allReactions.push({
              reaction_id: randomUUID(), message_id: rootId, user_id: u.userId,
              emoji: pick(['👍', '🎉', '🚀', '👀', '✅']), created_at: addHours(at, 1),
            });
          }
        }
      }

      // ── GitHub activity ───────────────────────────────────────────────────
      const ciRows: any[] = [];
      let runId = Date.now() % 1_000_000_000;
      for (let d = 0; d < HISTORY_DAYS; d++) {
        const day = addDays(start, d);
        if (isWeekend(day)) continue;
        const health = 0.66 + 0.26 * (d / HISTORY_DAYS); // CI gets healthier over time
        for (let r = 0; r < ri(0, 4); r++) {
          const at = addHours(day, ri(8, 19));
          if (at > now) continue;
          const ok = rand() < health;
          ciRows.push({
            id: randomUUID(), project_id: projectId, workflow_name: pick(['build', 'test', 'lint', 'e2e']),
            run_id: runId++, status: 'completed',
            conclusion: ok ? 'success' : pick(['failure', 'failure', 'cancelled']),
            head_branch: pick(['main', 'main', 'develop']), head_sha: sha(),
            html_url: `https://github.com/${p.repo}/actions`,
            triggered_at: at, completed_at: addHours(at, skew(90, 1500) / 3600), created_at: at,
          });
        }
      }
      for (let i = 0; i < ciRows.length; i += 400) {
        await sql`INSERT INTO github_ci_status ${sql(ciRows.slice(i, i + 400))}`;
      }

      const commitRows: any[] = [];
      for (let i = 0; i < Math.round(900 * p.weight); i++) {
        const at = skipWeekend(addDays(start, rand() * HISTORY_DAYS));
        if (at > now) continue;
        const a = pick(projMembers);
        commitRows.push({
          id: randomUUID(), project_id: projectId, commit_sha: sha(), repo_full_name: p.repo,
          message: 'demo commit', message_headline: pick(['fix flaky sprint test', 'add cycle time query', 'refactor board columns', 'bump deps', 'tidy analytics types', 'harden webhook verify']),
          author_name: a.name, author_github_login: a.name.split(' ')[0].toLowerCase(),
          author_user_id: a.userId, committed_at: at, branch_name: pick(['main', 'develop']),
          url: `https://github.com/${p.repo}`, created_at: at,
        });
      }
      for (let i = 0; i < commitRows.length; i += 400) {
        await sql`INSERT INTO github_commits ${sql(commitRows.slice(i, i + 400))} ON CONFLICT DO NOTHING`;
      }

      const prRows: any[] = [];
      const branchRows: any[] = [];
      const issueRows: any[] = [];
      for (let i = 1; i <= Math.round(200 * p.weight); i++) {
        const opened = skipWeekend(addDays(start, rand() * HISTORY_DAYS));
        const a = pick(projMembers);
        const merged = addHours(opened, skew(3, 6 * 24));
        const isMerged = merged <= now && rand() < 0.85;
        prRows.push({
          id: randomUUID(), project_id: projectId, pr_number: i,
          title: pick(['Add analytics endpoint', 'Fix board drag target', 'Extract sprint helpers', 'Index audit logs', 'Harden webhook verification']),
          state: isMerged ? 'merged' : merged > now ? 'open' : 'closed',
          html_url: `https://github.com/${p.repo}/pull/${i}`,
          head_branch: `feature/${p.key.toLowerCase()}-${i}`, base_branch: 'main',
          author_github_login: a.name.split(' ')[0].toLowerCase(), author_user_id: a.userId,
          merged_at: isMerged ? merged : null, closed_at: isMerged ? merged : null,
          created_at: opened, updated_at: isMerged ? merged : opened,
        });
        branchRows.push({
          id: randomUUID(), project_id: projectId, branch_name: `feature/${p.key.toLowerCase()}-${i}`,
          is_deleted: isMerged, created_by_user_id: a.userId,
          html_url: `https://github.com/${p.repo}/tree/feature/${p.key.toLowerCase()}-${i}`, created_at: opened,
        });
        if (rand() < 0.4) {
          issueRows.push({
            id: randomUUID(), project_id: projectId, github_issue_number: i,
            title: pick(TITLES.bug), body: null, state: rand() < 0.6 ? 'closed' : 'open',
            html_url: `https://github.com/${p.repo}/issues/${i}`,
            author_github_login: a.name.split(' ')[0].toLowerCase(), author_user_id: a.userId,
            labels: ['bug'], closed_at: rand() < 0.6 ? merged : null,
            created_at: opened, updated_at: opened,
          });
        }
      }
      for (const [rows, table] of [[prRows, 'github_pull_requests'], [branchRows, 'github_branches'], [issueRows, 'github_issues']] as const) {
        for (let i = 0; i < rows.length; i += 300) {
          const chunk = rows.slice(i, i + 300);
          if (!chunk.length) continue;
          await sql`INSERT INTO ${sql(table)} ${sql(chunk)} ON CONFLICT DO NOTHING`;
        }
      }

      console.log(`  ${p.key}: ${taskTarget} tasks · ${sprints.length} sprints · ${ciRows.length} ci · ${commitRows.length} commits · ${prRows.length} prs`);
    }

    // ── Bulk writes ─────────────────────────────────────────────────────────
    for (let i = 0; i < allTasks.length; i += 300) {
      await sql`INSERT INTO tasks ${sql(allTasks.slice(i, i + 300))}`;
    }
    for (let i = 0; i < allTransitions.length; i += 500) {
      await sql`INSERT INTO task_status_transitions ${sql(allTransitions.slice(i, i + 500))}`;
    }
    for (let i = 0; i < allSprintLinks.length; i += 400) {
      await sql`INSERT INTO sprint_tasks ${sql(allSprintLinks.slice(i, i + 400))} ON CONFLICT DO NOTHING`;
    }

    // Workspace-wide chatter in #general
    for (let i = 0; i < 120; i++) {
      const at = skipWeekend(addDays(start, rand() * HISTORY_DAYS));
      if (at > now) continue;
      allMessages.push({
        message_id: randomUUID(), channel_id: generalId, author_id: pick(people).userId,
        is_system: false, system_type: null, body_text: pick(CHAT), body_blocks: null,
        thread_id: null, reply_count: 0, is_pinned: false, created_at: at, updated_at: at,
      });
    }
    for (let i = 0; i < allMessages.length; i += 400) {
      await sql`INSERT INTO messages ${sql(allMessages.slice(i, i + 400))}`;
    }
    for (let i = 0; i < allReactions.length; i += 400) {
      await sql`INSERT INTO message_reactions ${sql(allReactions.slice(i, i + 400))} ON CONFLICT DO NOTHING`;
    }
    for (let i = 0; i < allAudit.length; i += 500) {
      await sql`INSERT INTO audit_logs ${sql(allAudit.slice(i, i + 500))}`;
    }

    // ── Notifications for the owner ─────────────────────────────────────────
    const recentDone = allTasks.filter((t) => t.completed_at).slice(-14);
    for (const [i, t] of recentDone.entries()) {
      allNotifications.push({
        notification_id: randomUUID(), recipient_id: people[0].userId,
        actor_id: pick(devs).userId,
        type: pick(['task_assigned', 'task_commented', 'task_mentioned', 'ci_failed', 'sprint_closed']),
        entity_type: 'task', entity_id: t.task_id,
        title: t.title, body: 'Activity on a task you follow.',
        is_read: i > 4, read_at: i > 4 ? t.completed_at : null,
        created_at: t.completed_at,
      });
    }
    await sql`INSERT INTO notifications ${sql(allNotifications)}`;

    // ── Report ──────────────────────────────────────────────────────────────
    const [{ n: taskN }] = await sql`SELECT count(*)::int AS n FROM tasks t JOIN projects p ON p.project_id=t.project_id WHERE p.workspace_id=${wsId}`;
    const cycle = await sql`
      SELECT status, round(avg(hours)::numeric,1) AS h, count(*)::int AS n FROM (
        SELECT to_status AS status,
          EXTRACT(EPOCH FROM (LEAD(changed_at) OVER (PARTITION BY task_id ORDER BY changed_at) - changed_at))/3600.0 AS hours
        FROM task_status_transitions tst
        JOIN projects p ON p.project_id = tst.project_id WHERE p.workspace_id = ${wsId}
      ) s WHERE hours IS NOT NULL GROUP BY status ORDER BY 2 DESC
    `;
    const [{ n: weeks }] = await sql`
      SELECT count(DISTINCT date_trunc('week', completed_at))::int AS n FROM tasks t
      JOIN projects p ON p.project_id=t.project_id WHERE p.workspace_id=${wsId} AND completed_at IS NOT NULL
    `;

    console.log('\n─── seeded ───');
    console.log(`tasks ${taskN} · transitions ${allTransitions.length} · messages ${allMessages.length} · audit ${allAudit.length} · sprints ${totalSprints}`);
    console.log('cycle time :', cycle.map((r) => `${r.status} ${r.h}h (n=${r.n})`).join(' · '));
    console.log('throughput :', weeks, 'weekly buckets');
    console.log(`\nSign in as ${OWNER_EMAIL} and open /w/${WS_SLUG}`);
    console.log(`Teammates: ${TEAM[0][1]} … ${TEAM[TEAM.length - 1][1]} (password ${PASSWORD})`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('Demo seed failed:', e);
  process.exit(1);
});
