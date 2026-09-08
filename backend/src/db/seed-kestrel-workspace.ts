/**
 * DevSync — Kestrel Robotics demo workspace
 *
 * A second aged workspace alongside `seed-demo-workspace.ts` (Northwind Labs),
 * which it never touches. The difference that matters is provenance:
 *
 *   Northwind's GitHub layer is invented — `sha()` random hex, the literal
 *   message 'demo commit', and URLs under `northwind/platform`, a repo that
 *   does not exist, so every link in the GitHub tab 404s.
 *
 *   Kestrel's GitHub layer is real. The commits, branches, pull requests and
 *   issues seeded here exist in `hrishikesh-thakare/github-integration-test`
 *   with these exact SHAs and numbers, so every link resolves. `history.json`
 *   is emitted by the generator that pushed them.
 *
 * What is still synthetic, and cannot not be:
 *   - the people, and therefore every task, message and assignment
 *   - CI history: GitHub Actions runs cannot be created or backdated via API,
 *     so `github_ci_status` is generated — against real commit SHAs
 *   - PR/issue timestamps on GitHub's side are creation-time; the backdated
 *     values live here, in DevSync's own rows
 *
 * `ai_summary` is a real Gemini call per closed sprint (best-effort; falls
 * back to null). `ai_contribution_report` is deliberately left null —
 * ai.service.ts removed per-person AI judgments as an anti-pattern, and
 * seeding them back in would contradict that.
 *
 * Writes directly to Postgres: created_at/changed_at/completed_at are all set
 * server-side by the API, so history cannot be backdated through it.
 *
 * Safe to re-run — drops its own workspace first; FK cascades do the rest.
 *
 * Run: npx tsx src/db/seed-kestrel-workspace.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { generateSprintReport } from '../services/ai.service.js';

const WS_NAME = 'Kestrel Robotics';
const WS_SLUG = 'kestrel-robotics';
const PASSWORD = 'Password123!';
const OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL || 'alice@demo.com';
const REPO = 'hrishikesh-thakare/github-integration-test';
const REPO_URL = `https://github.com/${REPO}`;
const HISTORY_JSON = process.env.KESTREL_HISTORY_JSON;

const HISTORY_DAYS = 182;
const SPRINT_DAYS = 14;
const DAY = 86_400_000;

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const addHours = (d: Date, n: number) => new Date(d.getTime() + n * 3_600_000);
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const skipWeekend = (d: Date) => { let o = d; while (isWeekend(o)) o = addHours(o, 12); return o; };

let s = 0x1f123bb5;
const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(x: readonly T[]): T => x[ri(0, x.length - 1)];
const some = <T>(x: readonly T[], n: number): T[] => [...x].sort(() => rand() - 0.5).slice(0, n);
const skew = (min: number, max: number) => min + (max - min) * rand() * rand();

/** Matches the commit authors in the generated git history, so `author_user_id` resolves. */
const TEAM = [
  ['Devika Rao', 'devika@kestrel.dev', 'admin'],
  ['Samuel Otieno', 'samuel@kestrel.dev', 'admin'],
  ['Yuki Tanaka', 'yuki@kestrel.dev', 'member'],
  ['Elena Vasquez', 'elena@kestrel.dev', 'member'],
  ['Omar Haddadi', 'omar@kestrel.dev', 'member'],
  ['Grace Lim', 'grace@kestrel.dev', 'member'],
  ['Fionn Murphy', 'fionn@kestrel.dev', 'member'],
  ['Ana Sokolova', 'ana@kestrel.dev', 'member'],
  ['Kwame Mensah', 'kwame@kestrel.dev', 'member'],
  ['Ravi Chandrasekar', 'ravi@kestrel.dev', 'member'],
] as const;

const PROJECTS = [
  { key: 'FLEET', name: 'Fleet Telemetry', desc: 'Uplink ingest, decoding and alerting for the vehicle fleet.', repo: REPO, weight: 0.46 },
  { key: 'GRD', name: 'Ground Control', desc: 'Operator dashboard and fleet console.', repo: null, weight: 0.34 },
  { key: 'FW', name: 'Onboard Firmware', desc: 'Vehicle-side firmware and CAN-bus agent.', repo: null, weight: 0.20 },
];

const LABELS = [
  ['telemetry', '#2563eb'], ['firmware', '#7c3aed'], ['bug', '#dc2626'],
  ['tech-debt', '#a16207'], ['performance', '#059669'], ['safety', '#be123c'],
  ['ops', '#db2777'], ['docs', '#475569'],
] as const;

const TITLES: Record<string, string[]> = {
  bug: [
    'Ring buffer drops frames on wraparound under burst load',
    'Out-of-order uplinks discard the whole batch',
    'Imperial fleets show km/h on the speed gauge',
    'Alerts fire twice after a rule reload',
    'Dead voltage sensor produces NaN in the rollup',
    'Retention job deletes the live partition',
    'Revoked fleet keys still authenticate for 10 minutes',
    'Clock skew over five minutes corrupts the time series',
    'Decoder rejects legacy firmware padding bytes',
    'Alert dispatch retries without backoff and floods the webhook',
  ],
  task: [
    'Add batch ingest endpoint for high-frequency uplinks',
    'Downsample telemetry older than thirty days',
    'Expose buffer depth on the health endpoint',
    'Paginate the fleet listing endpoints',
    'Emit ingest throughput metrics',
    'Add structured logging to the ingest path',
    'Batch the time-series writes',
    'Compress cold telemetry partitions',
    'Tighten tsconfig strictness across the service',
    'Document the alert rule schema',
    'Add per-scope checks on fleet API keys',
    'Speed up rule evaluation on large fleets',
  ],
  story: [
    'Operator can see live buffer depth per vehicle',
    'Fleet manager can target alert rules by vehicle tag',
    'Engineer can replay an uplink batch from cold storage',
    'Operator can acknowledge and silence an alert',
    'Support can trace a single frame end to end',
    'Fleet manager can export a telemetry window as CSV',
  ],
  epic: ['Telemetry ingest v2', 'Alerting overhaul', 'Cold storage and retention', 'Fleet API hardening'],
  subtask: ['Write the migration', 'Add regression coverage', 'Update the runbook', 'Wire the console', 'Review and merge'],
};

/**
 * Threaded conversations that actually read as conversations. The Northwind
 * seed picks each message independently from a flat list, so replies never
 * answer the message above them; these are written as exchanges.
 */
const THREADS: { root: string; replies: string[] }[] = [
  { root: 'Ingest latency spiked around 14:00 — anyone deploying?', replies: ['That was me, rolling out the batch endpoint.', 'Buffer depth is back under 200 now, looks like it absorbed the burst.', 'Fine by me then. Can we get an alert on depth so we are not eyeballing it?'] },
  { root: 'The retention job took out the live partition on staging last night.', replies: ['Ouch. Is that the boundary case we talked about in the last retro?', 'Same one. It compares dates, not partition ids, so the current one matches.', 'I will put a guard in today and add the regression test.'] },
  { root: 'Legacy firmware frames are still failing to decode for about 4% of the fleet.', replies: ['Those are the units that never got the 2.3 update — they pad with 0xFF.', 'Can we just skip the padding rather than rejecting the frame?', 'Yes, partial decode is safer than dropping the batch. Doing that.'] },
  { root: 'Why do we get two alerts for every threshold breach after a config push?', replies: ['Rule reload re-registers the dispatcher without tearing down the old one.', 'That explains the duplicate webhooks ops complained about.', 'Dedupe by rule id + vehicle + window should fix it.'] },
  { root: 'Review queue is getting long — 6 PRs open, oldest is 9 days.', replies: ['I can take three of them this afternoon.', 'Cycle time chart shows review is our slowest column by a mile.', 'Let us cap WIP at 4 next sprint and see if it moves.'] },
  { root: 'Imperial fleets are seeing km/h on the gauge.', replies: ['Conversion happens in the console, not the API, so the unit flag never reaches it.', 'Move it into lib/units and have both sides read the same helper.', 'Agreed, that is the fix.'] },
  { root: 'Heads up: rotating the fleet API keys tomorrow at 09:00 UTC.', replies: ['Does the auth cache honour revocation immediately now?', 'It does since the revocation fix landed last week.', 'Good, then no window where a revoked key still works.'] },
  { root: 'Cold storage read path is slower than the hot one by ~8x.', replies: ['Expected — it is decompressing whole partitions per query.', 'Can we downsample on write instead of on read?', 'That is the plan for the next sprint.'] },
  { root: 'CI has been red on main twice this week.', replies: ['Both were the flaky decoder fixture, not a real regression.', 'Can we quarantine it until the fixtures are rewritten?', 'Rewriting them now, should be green by tomorrow.'] },
  { root: 'Do we want the buffer depth metric on the operator dashboard or just internal?', replies: ['Operators have asked for it — they want to know when to throttle uploads.', 'Then dashboard, but as a health indicator rather than a raw number.', 'Works for me.'] },
  { root: 'Clock skew guard is rejecting a handful of legitimate uplinks.', replies: ['Five minutes is tight for units that sync over cellular.', 'Bump to fifteen? Still catches genuinely broken clocks.', 'Fifteen it is.'] },
  { root: 'Sprint goal for the next one — ingest v2 or alerting?', replies: ['Alerting. The duplicate-dispatch bug is costing ops real time.', 'Ingest v2 is bigger but nothing is on fire there.', 'Alerting then, and we carry the ingest spike over.'] },
];

const CHATTER = [
  'Merged, thanks for the quick review.',
  'CI is green on my branch now.',
  'Deploying to staging in a few minutes.',
  'Numbers look healthier this week.',
  'I can pick this up tomorrow morning.',
  'Nice — that shaved about 200ms off the rollup query.',
  'Blocked on the decoder change, ping me when it lands.',
  'Can we split this? Getting large for one PR.',
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
  const now = new Date();
  const start = addDays(now, -HISTORY_DAYS);

  // Real GitHub history emitted by the generator that pushed it.
  const history: {
    records: { sha: string; message: string; kind: string; at: string; author: string; email: string; branch: string }[];
    branches: { slug: string; title: string; kind: string; openedAt: string; author: string; email: string; shas: string[] }[];
    prs?: { number: number; title: string; branch: string; state: string; author: string; openedAt: string; mergedAt: string | null }[];
    issues?: { number: number; title: string; state: string; author: string; openedAt: string; closedAt: string | null }[];
  } = HISTORY_JSON && fs.existsSync(HISTORY_JSON)
    ? JSON.parse(fs.readFileSync(HISTORY_JSON, 'utf8'))
    : { records: [], branches: [] };

  console.log(`real github history: ${history.records.length} commits · ${history.branches.length} branches · ${history.prs?.length ?? 0} prs · ${history.issues?.length ?? 0} issues`);

  try {
    // ── Users ───────────────────────────────────────────────────────────────
    const [owner] = await sql`
      SELECT user_id, full_name FROM users WHERE email = ${OWNER_EMAIL} AND deleted_at IS NULL LIMIT 1
    `;
    if (!owner) throw new Error(`Owner ${OWNER_EMAIL} not found — run the e2e seed first.`);

    const hash = await bcrypt.hash(PASSWORD, 10);
    const people: { userId: string; name: string; email: string; role: string }[] = [
      { userId: owner.user_id as string, name: owner.full_name as string, email: OWNER_EMAIL, role: 'owner' },
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
      people.push({ userId: id, name, email, role: role as string });
    }
    const devs = people.slice(1);
    /**
     * Commit author -> DevSync user, so real commits attribute to real rows.
     * Keyed on email first: the owner account's display name is whatever the
     * e2e seed gave it ("Alice Carter"), which need not match the name the
     * git history was authored under, but the address is the same either way.
     */
    const byEmail = new Map(people.map((p) => [p.email.toLowerCase(), p]));
    const byNameOnly = new Map(people.map((p) => [p.name, p]));
    const resolve = (name: string, email?: string) =>
      (email ? byEmail.get(email.toLowerCase()) : undefined) ?? byNameOnly.get(name);
    console.log(`users: ${people.length} (owner ${OWNER_EMAIL} + ${TEAM.length} teammates)`);

    // ── Workspace ───────────────────────────────────────────────────────────
    await sql`DELETE FROM workspaces WHERE slug = ${WS_SLUG}`;
    const wsId = randomUUID();
    await sql`
      INSERT INTO workspaces (workspace_id, name, slug, description, owner_id, created_at, updated_at)
      VALUES (${wsId}, ${WS_NAME}, ${WS_SLUG},
              ${'Autonomous ground fleet — telemetry, control and firmware.'},
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
    await sql`
      INSERT INTO workspace_invites ${sql(
        ['nils@kestrel.dev', 'imani@kestrel.dev'].map((email, i) => ({
          workspace_id: wsId, email, role: 'member', token: randomUUID(),
          invited_by: people[0].userId, created_at: addDays(now, -4 - i), expires_at: addDays(now, 3 - i),
        })),
      )}
    `;
    console.log(`workspace: ${WS_SLUG} · ${people.length} members · 2 pending invites`);

    // ── Channels ────────────────────────────────────────────────────────────
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
      await sql`INSERT INTO channel_members ${sql(memberIds.map((uid) => ({ channel_id: id, user_id: uid, joined_at: start })))}`;
      return id;
    };

    const generalId = await mkChannel('general', 'public', null, { isDefault: true });
    await mkChannel('announcements', 'public', null, { announcement: true });
    const incidentsId = await mkChannel('incidents', 'public', null);
    await mkChannel('random', 'public', null);
    await mkChannel('leads', 'private', null, { memberIds: people.filter((p) => p.role !== 'member').map((p) => p.userId) });
    await mkChannel('dm', 'dm', null, { memberIds: [people[0].userId, devs[0].userId] });

    // ── Per-project build ───────────────────────────────────────────────────
    const allTasks: any[] = [];
    const allTransitions: any[] = [];
    const allMessages: any[] = [];
    const allReactions: any[] = [];
    const allAudit: any[] = [];
    const allSprintLinks: any[] = [];
    const sprintsForAi: { id: string; name: string; goal: string; start: Date; end: Date; projectKey: string }[] = [];
    let taskSeq = 0;
    let fleetProjectId = '';
    const fleetTasksByWindow: { id: string; key: string; from: Date; to: Date }[] = [];

    for (const p of PROJECTS) {
      const projectId = randomUUID();
      if (p.key === 'FLEET') fleetProjectId = projectId;
      const projLead = pick(devs);
      const projMembers = [people[0], ...some(devs, ri(5, 7))];

      await sql`
        INSERT INTO projects (project_id, workspace_id, name, key, description, lead_user_id, github_repo_owner, github_repo_name, issue_counter, status, created_at, updated_at)
        VALUES (${projectId}, ${wsId}, ${p.name}, ${p.key}, ${p.desc}, ${projLead.userId},
                ${p.repo ? p.repo.split('/')[0] : null}, ${p.repo ? p.repo.split('/')[1] : null},
                0, 'active', ${start}, ${now})
      `;
      await sql`
        INSERT INTO project_members ${sql(
          projMembers.map((m, i) => ({
            project_id: projectId, user_id: m.userId,
            role: i < 2 ? 'project_admin' : rand() < 0.88 ? 'developer' : 'viewer',
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

      // Only FLEET has a repo — the others show the app's genuine "not
      // connected" state rather than links into a repo that does not exist.
      if (p.repo) {
        await sql`
          INSERT INTO github_connections (project_id, connected_by, github_repo_full_name, github_repo_id, default_branch, created_at)
          VALUES (${projectId}, ${people[0].userId}, ${p.repo}, ${1_050_000 + ri(1, 9999)}, 'main', ${start})
        `;
      }

      // ── Sprints ───────────────────────────────────────────────────────────
      const sprintCount = Math.round(HISTORY_DAYS / SPRINT_DAYS);
      const sprints: { id: string; start: Date; end: Date; active: boolean; name: string; goal: string }[] = [];
      for (let i = 0; i < sprintCount; i++) {
        const sStart = addDays(now, -(sprintCount - i) * SPRINT_DAYS + 7);
        const sEnd = addDays(sStart, SPRINT_DAYS);
        const active = i === sprintCount - 1;
        const id = randomUUID();
        const name = `${p.key} Sprint ${i + 1}`;
        const goal = pick([
          'Cut ingest latency under burst load', 'Close out the alerting duplicates',
          'Harden the retention job', 'Reduce review latency', 'Ship cold-storage downsampling',
          'Stabilise CI on main',
        ]);
        sprints.push({ id, start: sStart, end: sEnd, active, name, goal });
        if (!active) sprintsForAi.push({ id, name, goal, start: sStart, end: sEnd, projectKey: p.key });

        await sql`
          INSERT INTO sprints (sprint_id, project_id, name, goal, status, start_date, end_date, closed_at, closed_by, velocity_issues, capacity_points, sequence_number, created_at, updated_at)
          VALUES (${id}, ${projectId}, ${name}, ${goal},
                  ${active ? 'active' : 'closed'}, ${sStart}, ${sEnd},
                  ${active ? null : sEnd}, ${active ? null : people[0].userId},
                  ${active ? null : ri(6, 15)}, ${ri(30, 48)}, ${i + 1},
                  ${sStart}, ${active ? now : sEnd})
        `;
      }

      // ── Tasks ─────────────────────────────────────────────────────────────
      const taskTarget = Math.round(400 * p.weight);
      const epics: string[] = [];

      for (let n = 1; n <= taskTarget; n++) {
        taskSeq++;
        const roll = rand();
        const issueType = roll < 0.03 ? 'epic' : roll < 0.17 ? 'story' : roll < 0.42 ? 'bug' : roll < 0.9 ? 'task' : 'subtask';
        const createdAt = skipWeekend(addDays(start, rand() * HISTORY_DAYS));

        const startedAt = skipWeekend(addHours(createdAt, skew(2, 18 * 24)));
        const reviewAt = skipWeekend(addHours(startedAt, skew(3, 7 * 24)));
        const doneAt = skipWeekend(addHours(reviewAt, skew(1, 4 * 24)));

        let stage: string;
        const r2 = rand();
        if (r2 < 0.71) stage = 'done';
        else if (r2 < 0.82) stage = 'in_review';
        else if (r2 < 0.93) stage = 'in_progress';
        else stage = 'todo';

        if (stage === 'done' && doneAt > now) stage = reviewAt <= now ? 'in_review' : startedAt <= now ? 'in_progress' : 'todo';
        if (stage === 'in_review' && reviewAt > now) stage = startedAt <= now ? 'in_progress' : 'todo';
        if (stage === 'in_progress' && startedAt > now) stage = 'todo';

        const assignee = pick(projMembers);
        const reporter = pick(projMembers);
        const taskId = randomUUID();
        const taskKey = `${p.key}-${n}`;
        const completedAt = stage === 'done' ? doneAt : null;
        const anchor = completedAt ?? startedAt;
        const sprint = sprints.find((sp) => anchor >= sp.start && anchor < sp.end);
        const epicId = issueType !== 'epic' && epics.length && rand() < 0.35 ? pick(epics) : null;
        if (issueType === 'epic') epics.push(taskId);

        allTasks.push({
          task_id: taskId, task_key: taskKey, project_id: projectId,
          epic_id: epicId, sprint_id: sprint?.id ?? null,
          title: pick(TITLES[issueType]), description: {}, description_text: '',
          issue_type: issueType, status: stage,
          priority: pick(['critical', 'high', 'medium', 'medium', 'medium', 'low']),
          reporter_id: reporter.userId, assignee_id: rand() < 0.9 ? assignee.userId : null,
          due_date: rand() < 0.35 ? addDays(createdAt, ri(3, 30)) : null,
          labels: some(labelNames, ri(0, 2)),
          rank: `a${String(taskSeq).padStart(6, '0')}`,
          story_points: issueType === 'epic' ? null : pick([1, 2, 2, 3, 3, 5, 5, 8, 13]),
          linked_commits_count: 0,
          completed_at: completedAt, created_at: createdAt, updated_at: completedAt ?? reviewAt,
        });

        if (p.key === 'FLEET' && stage !== 'todo') {
          fleetTasksByWindow.push({ id: taskId, key: taskKey, from: startedAt, to: completedAt ?? now });
        }

        allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: null, to_status: 'todo', actor_id: reporter.userId, changed_at: createdAt });
        if (stage !== 'todo') allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: 'todo', to_status: 'in_progress', actor_id: assignee.userId, changed_at: startedAt });
        if (stage === 'in_review' || stage === 'done') allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: 'in_progress', to_status: 'in_review', actor_id: assignee.userId, changed_at: reviewAt });
        if (stage === 'done') allTransitions.push({ id: randomUUID(), task_id: taskId, project_id: projectId, from_status: 'in_review', to_status: 'done', actor_id: assignee.userId, changed_at: doneAt });

        if (sprint) allSprintLinks.push({ sprint_id: sprint.id, task_id: taskId, was_completed_in_sprint: stage === 'done' });

        allAudit.push({
          log_id: randomUUID(), actor_id: reporter.userId, action: 'task.created',
          entity_type: 'task', entity_id: taskId, workspace_id: wsId, old_values: null,
          new_values: { task_key: taskKey, title: 'seeded', status: 'todo', project_id: projectId },
          created_at: createdAt,
        });
        if (stage === 'done') {
          allAudit.push({
            log_id: randomUUID(), actor_id: assignee.userId, action: 'task.status_changed',
            entity_type: 'task', entity_id: taskId, workspace_id: wsId,
            old_values: { status: 'in_review' }, new_values: { status: 'done' }, created_at: doneAt,
          });
        }
      }
      await sql`UPDATE projects SET issue_counter = ${taskTarget} WHERE project_id = ${projectId}`;

      // ── Project channel conversation ──────────────────────────────────────
      for (let i = 0; i < 14; i++) {
        const at = skipWeekend(addDays(start, rand() * HISTORY_DAYS));
        if (at > now) continue;
        const t = pick(THREADS);
        const rootId = randomUUID();
        allMessages.push({
          message_id: rootId, channel_id: projChannelId, author_id: pick(projMembers).userId,
          is_system: false, system_type: null, body_text: t.root, body_blocks: null,
          thread_id: null, reply_count: t.replies.length, is_pinned: rand() < 0.06,
          created_at: at, updated_at: at,
        });
        t.replies.forEach((r, idx) => {
          const rAt = addHours(at, (idx + 1) * skew(0.2, 5));
          if (rAt > now) return;
          allMessages.push({
            message_id: randomUUID(), channel_id: projChannelId, author_id: pick(projMembers).userId,
            is_system: false, system_type: null, body_text: r, body_blocks: null,
            thread_id: rootId, reply_count: 0, is_pinned: false, created_at: rAt, updated_at: rAt,
          });
        });
        if (rand() < 0.4) {
          for (const u of some(projMembers, ri(1, 3))) {
            allReactions.push({
              reaction_id: randomUUID(), message_id: rootId, user_id: u.userId,
              emoji: pick(['👍', '🎉', '🚀', '👀', '✅']), created_at: addHours(at, 1),
            });
          }
        }
      }
      for (let i = 0; i < 22; i++) {
        const at = skipWeekend(addDays(start, rand() * HISTORY_DAYS));
        if (at > now) continue;
        allMessages.push({
          message_id: randomUUID(), channel_id: projChannelId, author_id: pick(projMembers).userId,
          is_system: false, system_type: null, body_text: pick(CHATTER), body_blocks: null,
          thread_id: null, reply_count: 0, is_pinned: false, created_at: at, updated_at: at,
        });
      }

      console.log(`  ${p.key}: ${taskTarget} tasks · ${sprints.length} sprints${p.repo ? ' · real repo' : ''}`);
    }

    // ── Bulk writes ─────────────────────────────────────────────────────────
    for (let i = 0; i < allTasks.length; i += 300) await sql`INSERT INTO tasks ${sql(allTasks.slice(i, i + 300))}`;
    for (let i = 0; i < allTransitions.length; i += 500) await sql`INSERT INTO task_status_transitions ${sql(allTransitions.slice(i, i + 500))}`;
    for (let i = 0; i < allSprintLinks.length; i += 400) await sql`INSERT INTO sprint_tasks ${sql(allSprintLinks.slice(i, i + 400))} ON CONFLICT DO NOTHING`;

    // Workspace-wide chatter
    for (let i = 0; i < 40; i++) {
      const at = skipWeekend(addDays(start, rand() * HISTORY_DAYS));
      if (at > now) continue;
      allMessages.push({
        message_id: randomUUID(), channel_id: rand() < 0.75 ? generalId : incidentsId,
        author_id: pick(people).userId, is_system: false, system_type: null,
        body_text: pick(CHATTER), body_blocks: null, thread_id: null, reply_count: 0,
        is_pinned: false, created_at: at, updated_at: at,
      });
    }
    for (let i = 0; i < allMessages.length; i += 400) await sql`INSERT INTO messages ${sql(allMessages.slice(i, i + 400))}`;
    for (let i = 0; i < allReactions.length; i += 400) await sql`INSERT INTO message_reactions ${sql(allReactions.slice(i, i + 400))} ON CONFLICT DO NOTHING`;
    for (let i = 0; i < allAudit.length; i += 500) await sql`INSERT INTO audit_logs ${sql(allAudit.slice(i, i + 500))}`;

    // ── Real GitHub data ────────────────────────────────────────────────────
    // Every row below points at an object that exists in the repo, so the
    // GitHub tab's links resolve instead of 404ing.
    const commitRows = history.records.map((r) => {
      const at = new Date(r.at);
      const user = resolve(r.author, r.email);
      const linked = fleetTasksByWindow.find((t) => at >= t.from && at <= t.to);
      return {
        id: randomUUID(), project_id: fleetProjectId, task_id: linked?.id ?? null,
        commit_sha: r.sha, repo_full_name: REPO,
        message: r.message, message_headline: r.message.slice(0, 200),
        author_name: r.author, author_github_login: user?.email.split('@')[0] ?? null,
        author_user_id: user?.userId ?? null, committed_at: at, branch_name: r.branch,
        url: `${REPO_URL}/commit/${r.sha}`, created_at: at,
      };
    });
    for (let i = 0; i < commitRows.length; i += 300) {
      await sql`INSERT INTO github_commits ${sql(commitRows.slice(i, i + 300))} ON CONFLICT DO NOTHING`;
    }
    // Reflect the links back onto the tasks.
    await sql`
      UPDATE tasks t SET linked_commits_count = c.n
      FROM (SELECT task_id, count(*)::int AS n FROM github_commits WHERE task_id IS NOT NULL GROUP BY task_id) c
      WHERE t.task_id = c.task_id
    `;

    const branchRows = history.branches.map((b) => {
      const user = resolve(b.author, b.email);
      return {
        id: randomUUID(), project_id: fleetProjectId, task_id: null, branch_name: b.slug,
        is_deleted: false, created_by_user_id: user?.userId ?? null,
        html_url: `${REPO_URL}/tree/${b.slug}`, created_at: new Date(b.openedAt),
      };
    });
    if (branchRows.length) await sql`INSERT INTO github_branches ${sql(branchRows)} ON CONFLICT DO NOTHING`;

    const prRows = (history.prs ?? []).map((pr) => {
      const user = resolve(pr.author);
      return {
        id: randomUUID(), project_id: fleetProjectId, task_id: null, pr_number: pr.number,
        title: pr.title, body: null, state: pr.state,
        html_url: `${REPO_URL}/pull/${pr.number}`,
        head_branch: pr.branch, base_branch: 'main',
        author_github_login: user?.email.split('@')[0] ?? null, author_user_id: user?.userId ?? null,
        merged_at: pr.mergedAt ? new Date(pr.mergedAt) : null,
        closed_at: pr.mergedAt ? new Date(pr.mergedAt) : pr.state === 'closed' ? new Date(pr.openedAt) : null,
        created_at: new Date(pr.openedAt), updated_at: new Date(pr.mergedAt ?? pr.openedAt),
      };
    });
    if (prRows.length) await sql`INSERT INTO github_pull_requests ${sql(prRows)} ON CONFLICT DO NOTHING`;

    const issueRows = (history.issues ?? []).map((is) => {
      const user = resolve(is.author);
      return {
        id: randomUUID(), project_id: fleetProjectId, task_id: null,
        github_issue_number: is.number, title: is.title, body: null, state: is.state,
        html_url: `${REPO_URL}/issues/${is.number}`,
        author_github_login: user?.email.split('@')[0] ?? null, author_user_id: user?.userId ?? null,
        labels: ['bug'], closed_at: is.closedAt ? new Date(is.closedAt) : null,
        created_at: new Date(is.openedAt), updated_at: new Date(is.closedAt ?? is.openedAt),
      };
    });
    if (issueRows.length) await sql`INSERT INTO github_issues ${sql(issueRows)} ON CONFLICT DO NOTHING`;

    // ── CI history (generated — Actions runs cannot be backdated) ───────────
    // Anchored to real commit SHAs so each row points at a commit that exists.
    const mainCommits = history.records.filter((r) => r.branch === 'main');
    const ciRows: any[] = [];
    let runId = 12_000_000_000 + ri(1, 500_000);
    for (const r of mainCommits) {
      const at = new Date(r.at);
      const progress = (at.getTime() - start.getTime()) / (HISTORY_DAYS * DAY);
      const health = 0.62 + 0.3 * progress; // CI stabilises over the window
      for (const wf of ['build', 'test', 'lint']) {
        if (wf !== 'build' && rand() < 0.35) continue;
        const ok = rand() < health;
        const trig = addHours(at, skew(0.02, 0.4));
        if (trig > now) continue;
        ciRows.push({
          id: randomUUID(), project_id: fleetProjectId, workflow_name: wf, run_id: runId++,
          status: 'completed', conclusion: ok ? 'success' : pick(['failure', 'failure', 'cancelled']),
          head_branch: 'main', head_sha: r.sha,
          html_url: `${REPO_URL}/commit/${r.sha}/checks`,
          triggered_at: trig, completed_at: addHours(trig, skew(90, 1400) / 3600), created_at: trig,
        });
      }
    }
    for (let i = 0; i < ciRows.length; i += 400) {
      await sql`INSERT INTO github_ci_status ${sql(ciRows.slice(i, i + 400))}`;
    }

    // ── Real AI sprint summaries ────────────────────────────────────────────
    // The most recent closed sprints per project only. Every closed sprint
    // could be generated, but that is ~36 sequential Gemini calls against a
    // rate-limited key for summaries nobody scrolls back far enough to read.
    // Older sprints keep `ai_summary` null, which is also what the app itself
    // produces for sprints closed before the feature existed.
    const AI_PER_PROJECT = 5;
    const byProject = new Map<string, typeof sprintsForAi>();
    for (const sp of sprintsForAi) {
      const list = byProject.get(sp.projectKey) ?? [];
      list.push(sp);
      byProject.set(sp.projectKey, list);
    }
    const aiTargets = [...byProject.values()].flatMap((list) => list.slice(-AI_PER_PROJECT));

    let aiOk = 0, aiSkipped = 0;
    for (const sp of aiTargets) {
      const rows = await sql`
        SELECT t.task_key, t.title, t.issue_type, t.status, u.full_name, t.assignee_id
        FROM tasks t LEFT JOIN users u ON u.user_id = t.assignee_id
        WHERE t.sprint_id = ${sp.id} LIMIT 40
      `;
      if (!rows.length) { aiSkipped++; continue; }
      const completed = rows.filter((r: any) => r.status === 'done').length;
      try {
        const report = await generateSprintReport({
          sprintName: sp.name, goal: sp.goal, startDate: sp.start, endDate: sp.end,
          completedCount: completed, totalCount: rows.length,
          tasks: rows.map((r: any) => ({
            taskKey: r.task_key, title: r.title, issueType: r.issue_type,
            status: r.status, assigneeName: r.full_name ?? null, assigneeId: r.assignee_id ?? null,
          })),
        });
        if (report) {
          await sql`
            UPDATE sprints SET ai_summary = ${sql.json({ ...report, generatedAt: sp.end.toISOString() } as any)}
            WHERE sprint_id = ${sp.id}
          `;
          aiOk++;
        } else aiSkipped++;
      } catch (err: any) {
        aiSkipped++;
        if (aiSkipped <= 2) console.warn(`  ai: ${sp.name} failed — ${err?.message ?? err}`);
      }
      // Free-tier Gemini keys are limited per minute; unthrottled these fire
      // back to back and start 429ing partway through.
      await new Promise((r) => setTimeout(r, 1200));
    }

    // ── Notifications ───────────────────────────────────────────────────────
    const recentDone = allTasks.filter((t) => t.completed_at).sort((a, b) => b.completed_at - a.completed_at).slice(0, 16);
    if (recentDone.length) {
      await sql`INSERT INTO notifications ${sql(
        recentDone.map((t, i) => ({
          notification_id: randomUUID(), recipient_id: people[0].userId, actor_id: pick(devs).userId,
          type: pick(['task_assigned', 'task_commented', 'task_mentioned', 'ci_failed', 'sprint_closed']),
          entity_type: 'task', entity_id: t.task_id, title: t.title,
          body: 'Activity on a task you follow.', is_read: i > 5,
          read_at: i > 5 ? t.completed_at : null, created_at: t.completed_at,
        })),
      )}`;
    }

    // ── Report ──────────────────────────────────────────────────────────────
    const [{ n: taskN }] = await sql`SELECT count(*)::int AS n FROM tasks t JOIN projects p ON p.project_id=t.project_id WHERE p.workspace_id=${wsId}`;
    const [{ n: ciN }] = await sql`SELECT count(*)::int AS n FROM github_ci_status WHERE project_id=${fleetProjectId}`;
    const [{ n: linked }] = await sql`SELECT count(*)::int AS n FROM github_commits WHERE project_id=${fleetProjectId} AND task_id IS NOT NULL`;

    // Count what actually landed, not what was handed to the INSERT. Every
    // github_* write uses ON CONFLICT DO NOTHING, and `github_commits` is
    // unique on (repo_full_name, commit_sha) *globally* — so if another
    // project has the same repo connected and ingested a commit first, that
    // row is silently skipped here. Reporting the input length hides exactly
    // that, which is how a 53-commit shortfall went unnoticed on the first run.
    const [{ n: commitN }] = await sql`SELECT count(*)::int AS n FROM github_commits WHERE project_id = ${fleetProjectId}`;
    const [{ n: branchN }] = await sql`SELECT count(*)::int AS n FROM github_branches WHERE project_id = ${fleetProjectId}`;
    const [{ n: prN }] = await sql`SELECT count(*)::int AS n FROM github_pull_requests WHERE project_id = ${fleetProjectId}`;
    const [{ n: issueN }] = await sql`SELECT count(*)::int AS n FROM github_issues WHERE project_id = ${fleetProjectId}`;

    console.log('\n─── seeded ───');
    console.log(`tasks ${taskN} · transitions ${allTransitions.length} · messages ${allMessages.length} · audit ${allAudit.length}`);
    console.log(`github (real): ${commitN}/${commitRows.length} commits · ${branchN}/${branchRows.length} branches · ${prN}/${prRows.length} prs · ${issueN}/${issueRows.length} issues · ${linked} commits linked to tasks`);
    if (commitN < commitRows.length) {
      console.warn(`  ${commitRows.length - commitN} commits were skipped — another project already owns those SHAs for ${REPO}.`);
    }
    console.log(`github (generated): ${ciN} ci runs`);
    console.log(`ai sprint summaries: ${aiOk} generated, ${aiSkipped} skipped`);
    console.log(`\nSign in as ${OWNER_EMAIL} and open /w/${WS_SLUG}`);
    console.log(`Teammates: ${TEAM[0][1]} … ${TEAM[TEAM.length - 1][1]} (password ${PASSWORD})`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('Kestrel seed failed:', e);
  process.exit(1);
});
