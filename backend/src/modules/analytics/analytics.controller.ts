import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { projects, projectMembers } from '../../db/schema/projects.js';
import { tasks } from '../../db/schema/tasks.js';
import { sprints, sprintTasks } from '../../db/schema/sprints.js';
import { users } from '../../db/schema/auth.js';
import { githubCommits, githubPullRequests } from '../../db/schema/github.js';
import { eq, and, isNull, isNotNull, gte, lte, asc, desc, inArray, sql } from 'drizzle-orm';

/** Default reporting window when the caller does not supply one. */
const DEFAULT_WINDOW_DAYS = 90;

const STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'done'] as const;

const daysAgo = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

const startOfUTCDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Team & Delivery Analytics — the GitLab Value Stream equivalent.
 *
 * Explicitly NOT DORA. Deployment frequency, change failure rate and time to
 * restore all need deployment and incident concepts that DevSync has no model
 * for, so presenting any of them here would be a fabrication. Deployment
 * tracking is the prerequisite if that is ever wanted.
 *
 * Cycle time and burndown read `task_status_transitions`, never `audit_logs` —
 * see the note on that table for why.
 */
export const getWorkspaceAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = (req.params.workspaceId || res.locals.workspaceId) as string;
    const userId = req.user!.userId;
    const role = req.workspaceRole ?? 'member';
    const isAdmin = role === 'owner' || role === 'admin';

    const { projectKey, from, to } = req.query as Record<string, string>;

    const fromDate = from ? new Date(from) : daysAgo(DEFAULT_WINDOW_DAYS);
    const toDate = to ? new Date(to) : new Date();
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      res.status(400).json({ error: 'from and to must be valid dates.' });
      return;
    }
    if (fromDate > toDate) {
      res.status(400).json({ error: 'from must be earlier than to.' });
      return;
    }

    // ── Scope: which projects may this caller see? ──────────────────────────
    // Owners and admins see the whole workspace; a plain member sees only the
    // projects they belong to. Narrowed further when projectKey is supplied.
    const scopeRows = isAdmin
      ? await db
          .select({ projectId: projects.projectId, key: projects.key, name: projects.name })
          .from(projects)
          .where(eq(projects.workspaceId, workspaceId))
      : await db
          .select({ projectId: projects.projectId, key: projects.key, name: projects.name })
          .from(projects)
          .innerJoin(projectMembers, eq(projectMembers.projectId, projects.projectId))
          .where(and(eq(projects.workspaceId, workspaceId), eq(projectMembers.userId, userId)));

    let scoped = scopeRows;
    if (projectKey) {
      scoped = scopeRows.filter((p) => p.key.toUpperCase() === projectKey.toUpperCase());
      if (scoped.length === 0) {
        res.status(403).json({ error: 'No access to that project, or it does not exist.' });
        return;
      }
    }

    const projectIds = scoped.map((p) => p.projectId).filter((id): id is string => id !== null);

    if (projectIds.length === 0) {
      res.json({
        role,
        window: { from: fromDate, to: toDate },
        projects: [],
        cycleTime: [],
        throughput: [],
        velocity: [],
        contribution: [],
        ciTrend: [],
        burndown: [],
      });
      return;
    }

    // Parameterised id list for the raw-SQL queries below.
    const idList = sql.join(
      projectIds.map((id) => sql`${id}`),
      sql`, `,
    );

    // `db.execute` bypasses Drizzle's column type mappers, so postgres-js
    // receives bind params untouched and rejects a raw Date. Bind ISO strings
    // and let postgres do the cast.
    const fromParam = fromDate.toISOString();
    const toParam = toDate.toISOString();

    // ── Cycle time ──────────────────────────────────────────────────────────
    // A transition row marks the moment a task ENTERED `to_status`, so the time
    // spent in that status is the gap until the next transition. LEAD() pairs
    // them up; the final row of each task has no successor and drops out, which
    // is correct — the task is still sitting there.
    const cycleRows = (await db.execute(sql`
      SELECT
        status,
        avg(hours)                                            AS avg_hours,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY hours)    AS median_hours,
        count(*)::int                                         AS sample_size
      FROM (
        SELECT
          to_status AS status,
          EXTRACT(EPOCH FROM (
            LEAD(changed_at) OVER (PARTITION BY task_id ORDER BY changed_at) - changed_at
          )) / 3600.0 AS hours
        FROM task_status_transitions
        WHERE project_id IN (${idList})
          AND changed_at >= ${fromParam}::timestamptz
          AND changed_at <= ${toParam}::timestamptz
      ) spans
      WHERE hours IS NOT NULL
      GROUP BY status
    `)) as unknown as Array<{
      status: string;
      avg_hours: string | null;
      median_hours: string | null;
      sample_size: number;
    }>;

    const cycleByStatus = new Map(cycleRows.map((r) => [r.status, r]));
    const cycleTime = STATUS_ORDER.filter((s) => s !== 'done').map((status) => {
      const row = cycleByStatus.get(status);
      return {
        status,
        avgHours: row?.avg_hours != null ? Number(Number(row.avg_hours).toFixed(2)) : null,
        medianHours: row?.median_hours != null ? Number(Number(row.median_hours).toFixed(2)) : null,
        sampleSize: row?.sample_size ?? 0,
      };
    });

    // ── Throughput: tasks completed per ISO week ────────────────────────────
    const throughputRows = (await db.execute(sql`
      SELECT
        date_trunc('week', completed_at) AS week,
        count(*)::int                    AS completed
      FROM tasks
      WHERE project_id IN (${idList})
        AND deleted_at IS NULL
        AND completed_at IS NOT NULL
        AND completed_at >= ${fromParam}::timestamptz
        AND completed_at <= ${toParam}::timestamptz
      GROUP BY 1
      ORDER BY 1
    `)) as unknown as Array<{ week: Date; completed: number }>;

    const throughput = throughputRows.map((r) => ({
      week: r.week,
      completed: r.completed,
    }));

    // ── Velocity across closed sprints ──────────────────────────────────────
    // Reuses the sprint_tasks junction the sprint-close path already maintains
    // (see sprints.controller.ts) — incomplete tasks are unlinked on close, so
    // wasCompletedInSprint is the honest record of what actually shipped.
    const velocity = await db
      .select({
        sprintId: sprints.sprintId,
        name: sprints.name,
        sequenceNumber: sprints.sequenceNumber,
        endDate: sprints.endDate,
        projectId: sprints.projectId,
        completedPoints: sql<number>`coalesce(sum(case when ${sprintTasks.wasCompletedInSprint} then coalesce(${tasks.storyPoints}, 0) else 0 end), 0)::int`,
        completedCount: sql<number>`coalesce(sum(case when ${sprintTasks.wasCompletedInSprint} then 1 else 0 end), 0)::int`,
      })
      .from(sprints)
      .leftJoin(sprintTasks, eq(sprintTasks.sprintId, sprints.sprintId))
      .leftJoin(tasks, eq(tasks.taskId, sprintTasks.taskId))
      .where(and(inArray(sprints.projectId, projectIds), eq(sprints.status, 'closed')))
      .groupBy(sprints.sprintId, sprints.name, sprints.sequenceNumber, sprints.endDate, sprints.projectId)
      .orderBy(asc(sprints.sequenceNumber));

    // ── Contribution, per member ────────────────────────────────────────────
    // Task completion is attributed to the assignee (who did the work), not the
    // actor who dragged the card.
    const [taskCredit, commitCredit, prCredit] = await Promise.all([
      db
        .select({
          userId: tasks.assigneeId,
          tasksCompleted: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            inArray(tasks.projectId, projectIds),
            isNull(tasks.deletedAt),
            isNotNull(tasks.assigneeId),
            isNotNull(tasks.completedAt),
            gte(tasks.completedAt, fromDate),
            lte(tasks.completedAt, toDate),
          ),
        )
        .groupBy(tasks.assigneeId),

      db
        .select({
          userId: githubCommits.authorUserId,
          commits: sql<number>`count(*)::int`,
        })
        .from(githubCommits)
        .where(
          and(
            inArray(githubCommits.projectId, projectIds),
            isNotNull(githubCommits.authorUserId),
            gte(githubCommits.committedAt, fromDate),
            lte(githubCommits.committedAt, toDate),
          ),
        )
        .groupBy(githubCommits.authorUserId),

      db
        .select({
          userId: githubPullRequests.authorUserId,
          prsMerged: sql<number>`count(*)::int`,
        })
        .from(githubPullRequests)
        .where(
          and(
            inArray(githubPullRequests.projectId, projectIds),
            isNotNull(githubPullRequests.authorUserId),
            eq(githubPullRequests.state, 'merged'),
            isNotNull(githubPullRequests.mergedAt),
            gte(githubPullRequests.mergedAt, fromDate),
            lte(githubPullRequests.mergedAt, toDate),
          ),
        )
        .groupBy(githubPullRequests.authorUserId),
    ]);

    const contributionByUser = new Map<
      string,
      { tasksCompleted: number; commits: number; prsMerged: number }
    >();
    const bump = (id: string | null, patch: Partial<{ tasksCompleted: number; commits: number; prsMerged: number }>) => {
      if (!id) return;
      const cur = contributionByUser.get(id) ?? { tasksCompleted: 0, commits: 0, prsMerged: 0 };
      contributionByUser.set(id, { ...cur, ...patch });
    };
    for (const r of taskCredit) bump(r.userId, { tasksCompleted: r.tasksCompleted });
    for (const r of commitCredit) {
      const cur = contributionByUser.get(r.userId!) ?? { tasksCompleted: 0, commits: 0, prsMerged: 0 };
      bump(r.userId, { ...cur, commits: r.commits });
    }
    for (const r of prCredit) {
      const cur = contributionByUser.get(r.userId!) ?? { tasksCompleted: 0, commits: 0, prsMerged: 0 };
      bump(r.userId, { ...cur, prsMerged: r.prsMerged });
    }

    const contributorIds = [...contributionByUser.keys()];
    const contributorRows = contributorIds.length
      ? await db
          .select({ userId: users.userId, fullName: users.fullName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.userId, contributorIds))
      : [];

    const contribution = contributorRows
      .map((u) => ({
        userId: u.userId,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        ...(contributionByUser.get(u.userId) ?? { tasksCompleted: 0, commits: 0, prsMerged: 0 }),
      }))
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted || b.commits - a.commits);

    // ── CI trend ────────────────────────────────────────────────────────────
    const ciRows = (await db.execute(sql`
      SELECT
        date_trunc('day', triggered_at)                                AS day,
        count(*)::int                                                  AS total,
        sum(case when conclusion = 'success' then 1 else 0 end)::int   AS succeeded,
        avg(EXTRACT(EPOCH FROM (completed_at - triggered_at)))          AS avg_seconds
      FROM github_ci_status
      WHERE project_id IN (${idList})
        AND status = 'completed'
        AND triggered_at >= ${fromParam}::timestamptz
        AND triggered_at <= ${toParam}::timestamptz
      GROUP BY 1
      ORDER BY 1
    `)) as unknown as Array<{
      day: Date;
      total: number;
      succeeded: number;
      avg_seconds: string | null;
    }>;

    const ciTrend = ciRows.map((r) => ({
      day: r.day,
      total: r.total,
      succeeded: r.succeeded,
      successRate: r.total > 0 ? Math.round((r.succeeded / r.total) * 100) : 0,
      avgDurationSeconds: r.avg_seconds != null ? Math.round(Number(r.avg_seconds)) : null,
    }));

    // ── Burndown for active sprints ─────────────────────────────────────────
    // Now genuinely computable: `tasks.completed_at` gives the day each task
    // actually landed, so the line has real interior points rather than only
    // its two endpoints.
    const activeSprints = await db
      .select({
        sprintId: sprints.sprintId,
        name: sprints.name,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
        projectId: sprints.projectId,
      })
      .from(sprints)
      .where(and(inArray(sprints.projectId, projectIds), eq(sprints.status, 'active')))
      .orderBy(asc(sprints.endDate));

    const burndown = [];
    for (const sprint of activeSprints) {
      const sprintTaskRows = await db
        .select({
          taskId: tasks.taskId,
          storyPoints: tasks.storyPoints,
          completedAt: tasks.completedAt,
        })
        .from(tasks)
        .where(and(eq(tasks.sprintId, sprint.sprintId), isNull(tasks.deletedAt)));

      const totalPoints = sprintTaskRows.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

      const start = sprint.startDate ? startOfUTCDay(new Date(sprint.startDate)) : null;
      const end = sprint.endDate ? startOfUTCDay(new Date(sprint.endDate)) : null;
      if (!start || !end || totalPoints === 0) {
        burndown.push({
          sprintId: sprint.sprintId,
          name: sprint.name,
          projectId: sprint.projectId,
          totalPoints,
          series: [],
          note: !start || !end ? 'Sprint has no date range' : 'No estimated tasks in sprint',
        });
        continue;
      }

      const today = startOfUTCDay(new Date());
      const lastDay = today < end ? today : end;
      const spanDays = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      );

      const series = [];
      for (let d = new Date(start); d <= lastDay; d.setUTCDate(d.getUTCDate() + 1)) {
        const cursor = new Date(d);
        const donePoints = sprintTaskRows.reduce((sum, t) => {
          if (!t.completedAt) return sum;
          return startOfUTCDay(new Date(t.completedAt)) <= cursor ? sum + (t.storyPoints ?? 0) : sum;
        }, 0);
        const elapsed = Math.round((cursor.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        series.push({
          date: cursor.toISOString().slice(0, 10),
          remaining: totalPoints - donePoints,
          // Straight line from full scope to zero — the reference a burndown is read against.
          ideal: Math.max(0, Math.round((totalPoints * (1 - elapsed / spanDays)) * 10) / 10),
        });
      }

      burndown.push({
        sprintId: sprint.sprintId,
        name: sprint.name,
        projectId: sprint.projectId,
        totalPoints,
        series,
        note: null,
      });
    }

    res.json({
      role,
      window: { from: fromDate, to: toDate },
      projects: scoped,
      cycleTime,
      throughput,
      velocity,
      contribution,
      ciTrend,
      burndown,
    });
  } catch (err: any) {
    // Drizzle wraps the driver error; the cause carries the actual postgres
    // message, without which a failure here is unreadable.
    console.error('Get workspace analytics error:', err?.cause ?? err);
    res.status(500).json({ error: 'Server error building analytics.' });
  }
};
