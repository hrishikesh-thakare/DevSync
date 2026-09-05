import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { workspaceInvites } from '../../db/schema/workspaces.js';
import { projects, projectMembers } from '../../db/schema/projects.js';
import { tasks } from '../../db/schema/tasks.js';
import { sprints } from '../../db/schema/sprints.js';
import { users } from '../../db/schema/auth.js';
import { auditLogs } from '../../db/schema/audit.js';
import {
  eq, and, ne, isNull, isNotNull, desc, asc, inArray, lt, gt, sql,
} from 'drizzle-orm';

/** A task is "due soon" inside this many days. */
const DUE_SOON_DAYS = 3;
/** In Review for longer than this is flagged as stalled. */
const STALE_REVIEW_DAYS = 7;

const OPEN_STATUSES = ['todo', 'in_progress', 'in_review'] as const;

const daysFromNow = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * The signed-in landing payload, assembled per persona.
 *
 * Everything here is derived from data that actually exists. Two widgets the
 * original design called for are deliberately absent:
 *
 *  - "Needs my review" — no reviewer is ever recorded. `github_pull_requests`
 *    stores an author only, so there is nothing to filter on.
 *  - A sprint burndown *line* — nothing snapshots sprint state over time, so
 *    only the current completed-vs-total ratio is truthful. A real burndown
 *    means replaying `task.status_changed` audit rows, which is its own change.
 *
 * Admin-only sections are omitted from the response entirely (not merely
 * emptied) for members, so the shape itself never leaks their existence.
 */
export const getWorkspaceDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = (req.params.workspaceId || res.locals.workspaceId) as string;
    const userId = req.user!.userId;
    const role = req.workspaceRole ?? 'member';
    const isAdmin = role === 'owner' || role === 'admin';

    // Admins see every active project in the workspace; everyone else sees
    // only the ones they belong to.
    //
    // This used to be workspace-wide for all roles, which contradicted
    // `listProjects` — that endpoint deliberately hides non-member projects
    // from a plain member, while this one handed the same person those
    // projects' names, keys, sprint goals and dates through the dashboard.
    // Two views of the same permission cannot disagree; the stricter one wins.
    const projectRows = isAdmin
      ? await db
          .select({
            projectId: projects.projectId,
            key: projects.key,
            name: projects.name,
            status: projects.status,
          })
          .from(projects)
          .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, 'active'), isNull(projects.deletedAt)))
      : await db
          .select({
            projectId: projects.projectId,
            key: projects.key,
            name: projects.name,
            status: projects.status,
          })
          .from(projects)
          .innerJoin(
            projectMembers,
            and(
              eq(projectMembers.projectId, projects.projectId),
              eq(projectMembers.userId, userId),
            ),
          )
          .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, 'active'), isNull(projects.deletedAt)));

    const projectIds = projectRows.map((p) => p.projectId).filter((id): id is string => id !== null);

    // Nothing downstream is meaningful without projects, and `inArray` with an
    // empty list is not valid SQL — bail out with a well-formed empty payload.
    if (projectIds.length === 0) {
      res.json({
        role,
        persona: isAdmin ? 'admin' : 'contributor',
        myWork: { counts: { todo: 0, in_progress: 0, in_review: 0 }, overdue: 0, dueSoon: 0, tasks: [] },
        sprints: [],
        ...(isAdmin ? { projects: [], atRisk: { overdue: [], stalled: [] }, workload: [], pendingInvites: [], activity: [] } : {}),
      });
      return;
    }

    /**
     * Which dashboard this person actually needs.
     *
     * The workspace role alone cannot tell a contributor from a read-only
     * observer: both are `member`. Someone who is a `viewer` in every project
     * they belong to can act on nothing — no task will ever be assigned to
     * them, so a "My work" panel is permanently empty and a "needs your
     * attention" count is permanently zero. Leading their dashboard with either
     * is worse than useless; it teaches them the page has nothing to say.
     *
     * Three personas, which is the range role-based design is worth doing for:
     * admin (is the team on track, what needs me), contributor (what do I do
     * next), viewer (how is it going).
     */
    const myProjectRoles = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(inArray(projectMembers.projectId, projectIds), eq(projectMembers.userId, userId)),
      );

    const persona: 'admin' | 'contributor' | 'viewer' = isAdmin
      ? 'admin'
      : myProjectRoles.length > 0 && myProjectRoles.every((r) => r.role === 'viewer')
        ? 'viewer'
        : 'contributor';

    const now = new Date();
    const projectById = new Map(projectRows.map((p) => [p.projectId, p]));

    // ── My open work ────────────────────────────────────────────────────────
    const myTasks = await db
      .select({
        taskId: tasks.taskId,
        taskKey: tasks.taskKey,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        issueType: tasks.issueType,
        storyPoints: tasks.storyPoints,
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.projectId, projectIds),
          eq(tasks.assigneeId, userId),
          isNull(tasks.deletedAt),
          ne(tasks.status, 'done'),
        ),
      )
      .orderBy(asc(tasks.dueDate), desc(tasks.updatedAt));

    const counts: Record<string, number> = { todo: 0, in_progress: 0, in_review: 0 };
    let overdue = 0;
    let dueSoon = 0;
    const soonCutoff = daysFromNow(DUE_SOON_DAYS);

    for (const t of myTasks) {
      if (t.status && t.status in counts) counts[t.status] += 1;
      if (t.dueDate) {
        const due = new Date(t.dueDate);
        if (due < now) overdue += 1;
        else if (due <= soonCutoff) dueSoon += 1;
      }
    }

    const withProject = <T extends { projectId: string | null }>(row: T) => ({
      ...row,
      projectKey: row.projectId ? projectById.get(row.projectId)?.key ?? null : null,
      projectName: row.projectId ? projectById.get(row.projectId)?.name ?? null : null,
    });

    const myWork = {
      counts,
      overdue,
      dueSoon,
      // Due-date order puts the most urgent first; the page links to My Tasks
      // for the rest rather than rendering an unbounded list here.
      tasks: myTasks.slice(0, 5).map(withProject),
    };

    // ── Active sprint progress (current ratio, not a burndown) ──────────────
    const activeSprints = await db
      .select({
        sprintId: sprints.sprintId,
        name: sprints.name,
        goal: sprints.goal,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
        capacityPoints: sprints.capacityPoints,
        projectId: sprints.projectId,
      })
      .from(sprints)
      .where(and(inArray(sprints.projectId, projectIds), eq(sprints.status, 'active')))
      .orderBy(asc(sprints.endDate));

    const sprintIds = activeSprints.map((s) => s.sprintId);
    const sprintTaskRows = sprintIds.length
      ? await db
          .select({
            sprintId: tasks.sprintId,
            status: tasks.status,
            storyPoints: tasks.storyPoints,
          })
          .from(tasks)
          .where(and(inArray(tasks.sprintId, sprintIds), isNull(tasks.deletedAt)))
      : [];

    const sprintTotals = new Map<
      string,
      { totalTasks: number; doneTasks: number; totalPoints: number; donePoints: number }
    >();
    for (const id of sprintIds) {
      sprintTotals.set(id, { totalTasks: 0, doneTasks: 0, totalPoints: 0, donePoints: 0 });
    }
    for (const row of sprintTaskRows) {
      if (!row.sprintId) continue;
      const agg = sprintTotals.get(row.sprintId);
      if (!agg) continue;
      const points = row.storyPoints ?? 0;
      agg.totalTasks += 1;
      agg.totalPoints += points;
      if (row.status === 'done') {
        agg.doneTasks += 1;
        agg.donePoints += points;
      }
    }

    const sprintSummaries = activeSprints.map((s) => {
      const agg = sprintTotals.get(s.sprintId)!;
      const end = s.endDate ? new Date(s.endDate) : null;
      return {
        sprintId: s.sprintId,
        name: s.name,
        goal: s.goal,
        startDate: s.startDate,
        endDate: s.endDate,
        // Negative means the sprint is past its end date and still open.
        daysRemaining: end
          ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        capacityPoints: s.capacityPoints,
        ...agg,
        projectId: s.projectId,
        projectKey: s.projectId ? projectById.get(s.projectId)?.key ?? null : null,
        projectName: s.projectId ? projectById.get(s.projectId)?.name ?? null : null,
      };
    });

    if (!isAdmin) {
      res.json({ role, persona, myWork, sprints: sprintSummaries });
      return;
    }

    // ── Admin and owner sections ────────────────────────────────────────────
    const [statusAgg, memberAgg, overdueRows, stalledRows, workload, invites, activity] =
      await Promise.all([
        db
          .select({
            projectId: tasks.projectId,
            status: tasks.status,
            count: sql<number>`count(*)::int`,
          })
          .from(tasks)
          .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt)))
          .groupBy(tasks.projectId, tasks.status),

        db
          .select({
            projectId: projectMembers.projectId,
            count: sql<number>`count(*)::int`,
          })
          .from(projectMembers)
          .where(inArray(projectMembers.projectId, projectIds))
          .groupBy(projectMembers.projectId),

        db
          .select({
            taskId: tasks.taskId,
            taskKey: tasks.taskKey,
            title: tasks.title,
            status: tasks.status,
            priority: tasks.priority,
            dueDate: tasks.dueDate,
            projectId: tasks.projectId,
            assigneeName: users.fullName,
            assigneeAvatar: users.avatarUrl,
          })
          .from(tasks)
          .leftJoin(users, eq(tasks.assigneeId, users.userId))
          .where(
            and(
              inArray(tasks.projectId, projectIds),
              isNull(tasks.deletedAt),
              ne(tasks.status, 'done'),
              isNotNull(tasks.dueDate),
              lt(tasks.dueDate, now),
            ),
          )
          .orderBy(asc(tasks.dueDate))
          .limit(10),

        db
          .select({
            taskId: tasks.taskId,
            taskKey: tasks.taskKey,
            title: tasks.title,
            updatedAt: tasks.updatedAt,
            projectId: tasks.projectId,
            assigneeName: users.fullName,
            assigneeAvatar: users.avatarUrl,
          })
          .from(tasks)
          .leftJoin(users, eq(tasks.assigneeId, users.userId))
          .where(
            and(
              inArray(tasks.projectId, projectIds),
              isNull(tasks.deletedAt),
              eq(tasks.status, 'in_review'),
              lt(tasks.updatedAt, daysFromNow(-STALE_REVIEW_DAYS)),
            ),
          )
          .orderBy(asc(tasks.updatedAt))
          .limit(10),

        db
          .select({
            userId: users.userId,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
            openTasks: sql<number>`count(*)::int`,
          })
          .from(tasks)
          .innerJoin(users, eq(tasks.assigneeId, users.userId))
          .where(
            and(
              inArray(tasks.projectId, projectIds),
              isNull(tasks.deletedAt),
              inArray(tasks.status, [...OPEN_STATUSES]),
            ),
          )
          .groupBy(users.userId, users.fullName, users.avatarUrl)
          .orderBy(desc(sql`count(*)`))
          .limit(10),

        db
          .select({
            inviteId: workspaceInvites.inviteId,
            email: workspaceInvites.email,
            role: workspaceInvites.role,
            createdAt: workspaceInvites.createdAt,
            expiresAt: workspaceInvites.expiresAt,
            invitedByName: users.fullName,
          })
          .from(workspaceInvites)
          .leftJoin(users, eq(workspaceInvites.invitedBy, users.userId))
          .where(
            and(eq(workspaceInvites.workspaceId, workspaceId), gt(workspaceInvites.expiresAt, now)),
          )
          .orderBy(desc(workspaceInvites.createdAt))
          .limit(10),

        db
          .select({
            logId: auditLogs.logId,
            action: auditLogs.action,
            entityType: auditLogs.entityType,
            entityId: auditLogs.entityId,
            newValues: auditLogs.newValues,
            createdAt: auditLogs.createdAt,
            actorId: users.userId,
            actorName: users.fullName,
            actorAvatar: users.avatarUrl,
          })
          .from(auditLogs)
          .leftJoin(users, eq(auditLogs.actorId, users.userId))
          .where(eq(auditLogs.workspaceId, workspaceId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(10),
      ]);

    const progressByProject = new Map<string, { total: number; done: number }>();
    for (const id of projectIds) progressByProject.set(id, { total: 0, done: 0 });
    for (const row of statusAgg) {
      if (!row.projectId) continue;
      const agg = progressByProject.get(row.projectId);
      if (!agg) continue;
      agg.total += row.count;
      if (row.status === 'done') agg.done += row.count;
    }

    const memberCountByProject = new Map(
      memberAgg.map((m) => [m.projectId as string, m.count]),
    );
    const activeSprintByProject = new Map(
      activeSprints.filter((s) => s.projectId).map((s) => [s.projectId as string, s.name]),
    );

    res.json({
      role,
      persona,
      myWork,
      sprints: sprintSummaries,
      projects: projectRows.map((p) => {
        const agg = progressByProject.get(p.projectId) ?? { total: 0, done: 0 };
        return {
          projectId: p.projectId,
          key: p.key,
          name: p.name,
          totalTasks: agg.total,
          doneTasks: agg.done,
          percentComplete: agg.total === 0 ? 0 : Math.round((agg.done / agg.total) * 100),
          memberCount: memberCountByProject.get(p.projectId) ?? 0,
          activeSprintName: activeSprintByProject.get(p.projectId) ?? null,
        };
      }),
      atRisk: {
        overdue: overdueRows.map(withProject),
        stalled: stalledRows.map(withProject),
      },
      workload,
      pendingInvites: invites,
      activity,
    });
  } catch (err) {
    console.error('Get workspace dashboard error:', err);
    res.status(500).json({ error: 'Server error building dashboard.' });
  }
};
