import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { sprints, sprintTasks } from '../../db/schema/sprints.js';
import { tasks } from '../../db/schema/tasks.js';
import { channels, messages } from '../../db/schema/channels.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { logAuditAction } from '../audit/audit.controller.js';
import { createNotification } from '../notifications/notifications.controller.js';
import { users } from '../../db/schema/auth.js';
import { projectMembers } from '../../db/schema/projects.js';
import { projects } from '../../db/schema/projects.js';
import { getIO } from '../../sockets/index.js';
import { generateSprintReport, SprintReport } from '../../services/ai.service.js';

// ─── CREATE SPRINT ───────────────────────────────────────────────────────────
// POST /api/projects/:projectId/sprints
export const createSprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId || res.locals.projectId;
    const { name, goal, startDate, endDate } = req.body;

    // Auto-generate sequence number
    const [lastSprint] = await db
      .select({ seq: sprints.sequenceNumber })
      .from(sprints)
      .where(eq(sprints.projectId, projectId))
      .orderBy(sql`sequence_number DESC`)
      .limit(1);

    const sequenceNumber = lastSprint ? lastSprint.seq + 1 : 1;

    const result = await db.transaction(async (tx) => {
      const [sprint] = await tx
        .insert(sprints)
        .values({
          projectId,
          name: name.trim(),
          goal: goal || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          sequenceNumber,
          status: 'future',
        })
        .returning();

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, projectId));

      await logAuditAction({
        actorId: req.user!.userId,
        action: 'sprint.created',
        entityType: 'sprint',
        entityId: sprint.sprintId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: {
          name: sprint.name,
          goal: sprint.goal,
          start_date: sprint.startDate?.toISOString().split('T')[0] ?? null,
          end_date: sprint.endDate?.toISOString().split('T')[0] ?? null,
          project_id: sprint.projectId
        },
        tx
      });

      return sprint;
    });

    res.status(201).json({ message: 'Sprint created', sprint: result });
  } catch (err) {
    console.error('Create sprint error:', err);
    res.status(500).json({ error: 'Server error creating sprint.' });
  }
};

// ─── LIST SPRINTS ────────────────────────────────────────────────────────────
// GET /api/projects/:projectId/sprints
export const listSprints = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId || res.locals.projectId;

    const results = await db
      .select()
      .from(sprints)
      .where(eq(sprints.projectId, projectId))
      .orderBy(sql`sequence_number ASC`);

    res.json({ sprints: results });
  } catch (err) {
    console.error('List sprints error:', err);
    res.status(500).json({ error: 'Server error listing sprints.' });
  }
};

// ─── START SPRINT ────────────────────────────────────────────────────────────
// PATCH /api/projects/:projectId/sprints/:sprintId/start
export const startSprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sprintId } = req.params as Record<string, string>;
    const projectId = req.params.projectId || res.locals.projectId;
    const { startDate, endDate } = req.body;

    // Check no other sprint is active
    const [activeSprint] = await db
      .select({ sprintId: sprints.sprintId })
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'active')))
      .limit(1);

    if (activeSprint) {
      res.status(409).json({ error: 'An active sprint already exists. Close it before starting a new one.' });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(sprints)
        .set({
          status: 'active',
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : null,
          updatedAt: new Date(),
        })
        .where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId), eq(sprints.status, 'future')))
        .returning();

      if (!updated) return null;

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, updated.projectId!));

      await logAuditAction({
        actorId: req.user!.userId,
        action: 'sprint.started',
        entityType: 'sprint',
        entityId: updated.sprintId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: { status: 'active', start_date: updated.startDate?.toISOString().split('T')[0] },
        oldValues: { status: 'future' },
        tx
      });

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Sprint not found or not in "future" status.' });
      return;
    }

    // --- NOTIFICATIONS ---
    const actorId = req.user!.userId;
    const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));
    const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.projectId, projectId));
    const members = await db.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, projectId));
    const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.sprintId, sprintId));

    for (const member of members) {
      if (member.userId !== actorId) {
        await createNotification({
          recipientId: member.userId as string,
          actorId,
          type: 'sprint_started',
          entityType: 'sprint',
          entityId: sprintId,
          title: `${result.name} has started in ${project?.name || 'Project'}`,
          body: `${actor?.name || 'Someone'} started ${result.name}. Ends ${result.endDate ? result.endDate.toISOString().split('T')[0] : 'TBD'}. ${taskCount?.count || 0} tasks in sprint.`,
        });
      }
    }

    res.json({ message: 'Sprint started', sprint: result });
  } catch (err) {
    console.error('Start sprint error:', err);
    res.status(500).json({ error: 'Server error starting sprint.' });
  }
};

// ─── CLOSE SPRINT ────────────────────────────────────────────────────────────
// PATCH /api/projects/:projectId/sprints/:sprintId/close
export const closeSprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sprintId } = req.params as Record<string, string>;
    const projectId = req.params.projectId || res.locals.projectId;
    const userId = req.user!.userId;

    const [sprint] = await db.select({ status: sprints.status, name: sprints.name, projectId: sprints.projectId }).from(sprints).where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId)));
    
    if (!sprint) {
      res.status(404).json({ error: 'Sprint not found.' });
      return;
    }

    if (sprint.status !== 'active') {
      res.status(400).json({ error: 'Only an active sprint can be closed.' });
      return;
    }

    // Get tasks in this sprint and count completed ones
    const sprintTaskList = await db
      .select({
        taskId: tasks.taskId,
        status: tasks.status,
      })
      .from(tasks)
      .where(eq(tasks.sprintId, sprintId));

    const completedCount = sprintTaskList.filter(t => t.status?.toUpperCase() === 'DONE').length;

    await db.transaction(async (tx) => {
      // 1. Close the sprint
      const [closedSprint] = await tx
        .update(sprints)
        .set({
          status: 'closed',
          closedAt: new Date(),
          closedBy: userId,
          velocityIssues: completedCount,
          updatedAt: new Date(),
        })
        .where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId)))
        .returning();

      // 2. Record task completion status in sprint_tasks junction
      for (const task of sprintTaskList) {
        await tx.insert(sprintTasks).values({
          sprintId,
          taskId: task.taskId,
          wasCompletedInSprint: task.status?.toUpperCase() === 'DONE',
        }).onConflictDoNothing();
      }

      // 3. Move incomplete tasks back to backlog (clear sprintId)
      const incompleteTasks = sprintTaskList
        .filter(t => t.status?.toUpperCase() !== 'DONE')
        .map(t => t.taskId);

      if (incompleteTasks.length > 0) {
        await tx
          .update(tasks)
          .set({ sprintId: null, updatedAt: new Date() })
          .where(inArray(tasks.taskId, incompleteTasks));
      }

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, closedSprint.projectId!));

      await logAuditAction({
        actorId: userId,
        action: 'sprint.closed',
        entityType: 'sprint',
        entityId: sprintId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: { status: 'closed', closed_at: closedSprint.closedAt?.toISOString(), velocity_issues: completedCount, incomplete_tasks_moved_to: 'backlog' },
        oldValues: { status: 'active' },
        tx
      });
    });

    // --- NOTIFICATIONS ---
    const actorId = req.user!.userId;
    const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));
    const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.projectId, sprint.projectId!));
    const members = await db.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, sprint.projectId!));

    for (const member of members) {
      if (member.userId !== actorId) {
        await createNotification({
          recipientId: member.userId as string,
          actorId,
          type: 'sprint_closed',
          entityType: 'sprint',
          entityId: sprintId,
          title: `${sprint.name} was closed in ${project?.name || 'Project'}`,
          body: `${actor?.name || 'Someone'} closed ${sprint.name}. ${completedCount} of ${sprintTaskList.length} tasks completed.`,
        });
      }
    }

    res.json({
      message: 'Sprint closed',
      stats: {
        totalTasks: sprintTaskList.length,
        completed: completedCount,
        incomplete: sprintTaskList.length - completedCount,
      },
    });

    // ─── AI Sprint Report (fire-and-forget, never blocks the close) ───
    generateSprintReportAndPost({ sprintId, projectId })
      .catch(err => console.error('AI sprint report generation failed:', err));
  } catch (err) {
    console.error('Close sprint error:', err);
    res.status(500).json({ error: 'Server error closing sprint.' });
  }
};

// ─── UPDATE SPRINT ───────────────────────────────────────────────────────────
// PATCH /api/projects/:projectId/sprints/:sprintId
export const updateSprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sprintId } = req.params as Record<string, string>;
    const projectId = req.params.projectId || res.locals.projectId;
    const { name, goal, startDate, endDate } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (goal !== undefined) updateData.goal = goal;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const result = await db.transaction(async (tx) => {
      const [oldSprint] = await tx.select().from(sprints).where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId))).limit(1);

      const [updated] = await tx
        .update(sprints)
        .set(updateData)
        .where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId)))
        .returning();

      if (!updated || !oldSprint) return null;

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, updated.projectId!));
      const workspaceId = project?.workspaceId ?? undefined;

      const actorId = req.user!.userId;
      const eType = 'sprint';
      const eId = updated.sprintId;

      if (oldSprint.name !== updated.name) {
        await logAuditAction({
          actorId, action: 'sprint.name_changed', entityType: eType, entityId: eId, workspaceId,
          newValues: { name: updated.name }, oldValues: { name: oldSprint.name }, tx
        });
      }
      if (oldSprint.goal !== updated.goal) {
        await logAuditAction({
          actorId, action: 'sprint.goal_changed', entityType: eType, entityId: eId, workspaceId,
          newValues: { goal: updated.goal }, oldValues: { goal: oldSprint.goal }, tx
        });
      }
      const oldStart = oldSprint.startDate?.toISOString().split('T')[0];
      const newStart = updated.startDate?.toISOString().split('T')[0];
      const oldEnd = oldSprint.endDate?.toISOString().split('T')[0];
      const newEnd = updated.endDate?.toISOString().split('T')[0];
      if (oldStart !== newStart || oldEnd !== newEnd) {
        await logAuditAction({
          actorId, action: 'sprint.dates_changed', entityType: eType, entityId: eId, workspaceId,
          newValues: { start_date: newStart, end_date: newEnd }, oldValues: { start_date: oldStart, end_date: oldEnd }, tx
        });
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Sprint not found.' });
      return;
    }

    res.json({ message: 'Sprint updated', sprint: result });
  } catch (err) {
    console.error('Update sprint error:', err);
    res.status(500).json({ error: 'Server error updating sprint.' });
  }
};

// ─── DELETE SPRINT ───────────────────────────────────────────────────────────
// DELETE /api/projects/:projectId/sprints/:sprintId
export const deleteSprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sprintId } = req.params as Record<string, string>;
    const projectId = req.params.projectId || res.locals.projectId;

    const result = await db.transaction(async (tx) => {
      const [sprint] = await tx.select().from(sprints).where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId))).limit(1);
      if (!sprint) return null;

      // Unlink all tasks from this sprint first
      await tx
        .update(tasks)
        .set({ sprintId: null, updatedAt: new Date() })
        .where(eq(tasks.sprintId, sprintId));

      const [deleted] = await tx
        .delete(sprints)
        .where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId)))
        .returning({ sprintId: sprints.sprintId });

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, sprint.projectId!));

      await logAuditAction({
        actorId: req.user!.userId,
        action: 'sprint.deleted',
        entityType: 'sprint',
        entityId: deleted.sprintId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: null,
        oldValues: { name: sprint.name, status: sprint.status },
        tx
      });

      return deleted;
    });

    if (!result) {
      res.status(404).json({ error: 'Sprint not found.' });
      return;
    }

    res.json({ message: 'Sprint deleted' });
  } catch (err) {
    console.error('Delete sprint error:', err);
    res.status(500).json({ error: 'Server error deleting sprint.' });
  }
};

// ─── ADD TASK TO SPRINT ──────────────────────────────────────────────────────
// POST /api/workspaces/:slug/projects/:key/sprints/:sprintId/tasks
export const addTaskToSprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sprintId } = req.params as Record<string, string>;
    const projectId = req.params.projectId || res.locals.projectId;
    const { taskId } = req.body;

    // Verify the task exists, belongs to the same project as the sprint,
    // and the sprint belongs to the URL's project
    const result = await db.transaction(async (tx) => {
      const [sprint] = await tx.select().from(sprints).where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId))).limit(1);
      if (!sprint) return null;

      const [task] = await tx.select({ taskId: tasks.taskId, taskKey: tasks.taskKey, projectId: tasks.projectId }).from(tasks).where(eq(tasks.taskId, taskId)).limit(1);
      if (!task) return null;

      if (task.projectId !== projectId) return 'cross-project';

      await tx.insert(sprintTasks).values({
        sprintId,
        taskId,
        wasCompletedInSprint: false,
      }).onConflictDoNothing();

      await tx
        .update(tasks)
        .set({ sprintId, updatedAt: new Date() })
        .where(eq(tasks.taskId, taskId));

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, sprint.projectId!));
      await logAuditAction({
        actorId: req.user!.userId,
        action: 'sprint.task_added',
        entityType: 'sprint',
        entityId: sprintId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: { task_id: task.taskId, task_key: task.taskKey, added_by: req.user!.userId },
        tx
      });
      return true;
    });

    if (!result) {
      res.status(404).json({ error: 'Sprint or task not found.' });
      return;
    }
    if (result === 'cross-project') {
      res.status(400).json({ error: 'Task does not belong to this project.' });
      return;
    }

    res.status(201).json({ message: 'Task added to sprint' });
  } catch (err) {
    console.error('Add task to sprint error:', err);
    res.status(500).json({ error: 'Server error adding task to sprint.' });
  }
};

// ─── REMOVE TASK FROM SPRINT ─────────────────────────────────────────────────
// DELETE /api/workspaces/:slug/projects/:key/sprints/:sprintId/tasks/:taskId
export const removeTaskFromSprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sprintId, taskId } = req.params as Record<string, string>;
    const projectId = req.params.projectId || res.locals.projectId;

    const result = await db.transaction(async (tx) => {
      const [sprint] = await tx.select().from(sprints).where(and(eq(sprints.sprintId, sprintId), eq(sprints.projectId, projectId))).limit(1);
      if (!sprint) return null;

      const [task] = await tx.select({ taskId: tasks.taskId, taskKey: tasks.taskKey, projectId: tasks.projectId }).from(tasks).where(eq(tasks.taskId, taskId)).limit(1);
      if (!task) return null;

      if (task.projectId !== projectId) return 'cross-project';

      await tx
        .delete(sprintTasks)
        .where(and(eq(sprintTasks.sprintId, sprintId), eq(sprintTasks.taskId, taskId)));

      await tx
        .update(tasks)
        .set({ sprintId: null, updatedAt: new Date() })
        .where(eq(tasks.taskId, taskId));

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, sprint.projectId!));
      await logAuditAction({
        actorId: req.user!.userId,
        action: 'sprint.task_removed',
        entityType: 'sprint',
        entityId: sprintId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: null,
        oldValues: { task_id: task.taskId, task_key: task.taskKey },
        tx
      });
      return true;
    });

    if (!result) {
      res.status(404).json({ error: 'Sprint or task not found.' });
      return;
    }
    if (result === 'cross-project') {
      res.status(400).json({ error: 'Task does not belong to this project.' });
      return;
    }

    res.json({ message: 'Task removed from sprint' });
  } catch (err) {
    console.error('Remove task from sprint error:', err);
    res.status(500).json({ error: 'Server error removing task from sprint.' });
  }
};

// ─── AI SPRINT REPORT GENERATION ─────────────────────────────────────────────
const buildSummaryMessage = (sprintName: string, projectName: string | undefined, report: SprintReport): string => {
  const lines = [
    `AI Sprint Summary — ${sprintName}${projectName ? ` (${projectName})` : ''}`,
    '',
    report.summary,
    '',
  ];

  if (report.highlights.length > 0) {
    lines.push('Highlights:', ...report.highlights.map(h => `- ${h}`), '');
  }

  if (report.contributionReport.length > 0) {
    lines.push('Contributions:');
    for (const c of report.contributionReport) {
      lines.push(`- ${c.fullName}: ${c.summary} (${c.tasksCompleted} tasks completed)`);
    }
  }

  return lines.join('\n');
};

/**
 * Generates the AI sprint retrospective (summary + per-member contribution
 * report), persists it on the sprint row, and posts it to the project's
 * first channel as a system message. Fails silently on any error.
 */
const generateSprintReportAndPost = async (params: { sprintId: string; projectId: string }): Promise<void> => {
  const { sprintId, projectId } = params;

  const [sprint] = await db
    .select()
    .from(sprints)
    .where(eq(sprints.sprintId, sprintId))
    .limit(1);
  if (!sprint) return;

  const taskList = await db
    .select({
      taskKey: tasks.taskKey,
      title: tasks.title,
      issueType: tasks.issueType,
      status: tasks.status,
      assigneeId: tasks.assigneeId,
      assigneeName: users.fullName,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.userId))
    .where(eq(tasks.sprintId, sprintId));

  const [project] = await db
    .select({ name: projects.name, workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.projectId, projectId))
    .limit(1);

  const report = await generateSprintReport({
    sprintName: sprint.name,
    goal: sprint.goal,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    completedCount: taskList.filter(t => t.status?.toUpperCase() === 'DONE').length,
    totalCount: taskList.length,
    tasks: taskList.map(t => ({
      taskKey: t.taskKey,
      title: t.title,
      issueType: t.issueType,
      status: t.status,
      assigneeName: t.assigneeName,
      assigneeId: t.assigneeId,
    })),
  });

  if (!report) return;

  // Post the summary to the project's first channel as a system message
  const [channel] = await db
    .select({ channelId: channels.channelId })
    .from(channels)
    .where(eq(channels.projectId, projectId))
    .limit(1);

  let summaryMessageId: string | null = null;

  if (channel) {
    const bodyText = buildSummaryMessage(sprint.name, project?.name, report);
    const now = new Date();

    const [msg] = await db
      .insert(messages)
      .values({
        channelId: channel.channelId,
        isSystem: true,
        systemType: 'ai_sprint_summary',
        bodyText,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    summaryMessageId = msg.messageId;

    const io = getIO();
    if (io) {
      io.to(`channel:${channel.channelId}`).emit('new_message', {
        messageId: msg.messageId,
        channelId: msg.channelId,
        authorId: null,
        authorName: 'DevSync AI',
        authorAvatar: null,
        isSystem: true,
        systemType: 'ai_sprint_summary',
        bodyText,
        threadId: null,
        replyCount: 0,
        isEdited: false,
        isDeleted: false,
        createdAt: msg.createdAt,
      });
    }
  }

  await db
    .update(sprints)
    .set({
      aiSummary: {
        summary: report.summary,
        highlights: report.highlights,
        generatedAt: new Date().toISOString(),
      },
      aiContributionReport: report.contributionReport,
      summaryMessageId,
      updatedAt: new Date(),
    })
    .where(eq(sprints.sprintId, sprintId));

  await logAuditAction({
    actorId: null,
    action: 'sprint.ai_report_generated',
    entityType: 'sprint',
    entityId: sprintId,
    workspaceId: project?.workspaceId ?? undefined,
    newValues: { has_summary: true, has_contribution_report: true, posted_to_channel: Boolean(summaryMessageId) },
  });
};
