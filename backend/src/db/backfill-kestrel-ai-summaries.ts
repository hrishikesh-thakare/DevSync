/**
 * Fills in `ai_summary` for Kestrel sprints the main seed could not generate.
 *
 * The seed's Gemini calls are best-effort and several came back 503 "model is
 * currently experiencing high demand" — transient upstream load, not bad input.
 * This retries only the sprints still missing a summary, so it is safe to run
 * repeatedly and does no work once they are all filled.
 *
 * Run: npx tsx src/db/backfill-kestrel-ai-summaries.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { generateSprintReport } from '../services/ai.service.js';

const WS_SLUG = 'kestrel-robotics';
/** Matches the seed: the most recent closed sprints per project, not all of them. */
const PER_PROJECT = 5;
const ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
  try {
    const targets = await sql<{
      sprint_id: string; name: string; goal: string | null;
      start_date: Date; end_date: Date; key: string;
    }[]>`
      -- Rank ALL closed sprints, take the newest N per project, and only then
      -- drop the ones already summarised. Filtering on ai_summary IS NULL
      -- before the window instead ranks only the unfilled sprints, so the
      -- window slides further back every time one gets filled and the script
      -- walks the entire history rather than stopping at N.
      SELECT * FROM (
        SELECT s.sprint_id, s.name, s.goal, s.start_date, s.end_date, p.key, s.ai_summary,
               row_number() OVER (PARTITION BY p.project_id ORDER BY s.sequence_number DESC) AS rn
        FROM sprints s
        JOIN projects p ON p.project_id = s.project_id
        JOIN workspaces w ON w.workspace_id = p.workspace_id
        WHERE w.slug = ${WS_SLUG} AND s.status = 'closed'
      ) t WHERE rn <= ${PER_PROJECT} AND ai_summary IS NULL
    `;

    if (!targets.length) {
      console.log('nothing to backfill — every targeted sprint already has a summary');
      return;
    }
    console.log(`backfilling ${targets.length} sprint summaries...`);

    let ok = 0, failed = 0;
    for (const sp of targets) {
      const rows = await sql`
        SELECT t.task_key, t.title, t.issue_type, t.status, u.full_name, t.assignee_id
        FROM tasks t LEFT JOIN users u ON u.user_id = t.assignee_id
        WHERE t.sprint_id = ${sp.sprint_id} LIMIT 40
      `;
      if (!rows.length) { failed++; continue; }
      const completed = rows.filter((r: any) => r.status === 'done').length;

      let done = false;
      for (let attempt = 1; attempt <= ATTEMPTS && !done; attempt++) {
        try {
          const report = await generateSprintReport({
            sprintName: sp.name, goal: sp.goal,
            startDate: new Date(sp.start_date), endDate: new Date(sp.end_date),
            completedCount: completed, totalCount: rows.length,
            tasks: rows.map((r: any) => ({
              taskKey: r.task_key, title: r.title, issueType: r.issue_type,
              status: r.status, assigneeName: r.full_name ?? null, assigneeId: r.assignee_id ?? null,
            })),
          });
          if (report) {
            await sql`
              UPDATE sprints
              SET ai_summary = ${sql.json({ ...report, generatedAt: new Date(sp.end_date).toISOString() } as any)}
              WHERE sprint_id = ${sp.sprint_id}
            `;
            ok++; done = true;
          }
        } catch (err: any) {
          if (attempt === ATTEMPTS) console.warn(`  ${sp.name}: ${err?.message ?? err}`);
        }
        // 503s here are load-shedding, so back off rather than hammering.
        if (!done) await sleep(2500 * attempt);
      }
      if (!done) failed++;
      await sleep(1200);
    }
    console.log(`backfilled: ${ok} · still failing: ${failed}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error('Backfill failed:', e); process.exit(1); });
