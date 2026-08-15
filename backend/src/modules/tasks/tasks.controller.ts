import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { tasks } from '../../db/schema/tasks.js';
import { projects, projectMembers } from '../../db/schema/projects.js';
import { sprints } from '../../db/schema/sprints.js';
import { users } from '../../db/schema/auth.js';
import { messages, channels } from '../../db/schema/channels.js';
import { eq, and, isNull, asc, desc, sql, or, ilike } from 'drizzle-orm';
import { logAuditAction } from '../audit/audit.controller.js';
import { createNotification } from '../notifications/notifications.controller.js';
import { getIO } from '../../sockets/index.js';

import { generateKeyBetween } from 'fractional-indexing';

// ─── HELPER: Broadcast to Project Channels ───────────────────────────────────
const broadcastToProjectChannels = async (tx: any, projectId: string, bodyText: string): Promise<void> => {
  // Find all channels linked to this project
  const projectChannels = await tx.select({ channelId: channels.channelId }).from(channels).where(eq(channels.projectId, projectId));
  if (projectChannels.length === 0) return;

  const now = new Date();
  
  for (const { channelId } of projectChannels) {
    // Insert system message
    const [msg] = await tx.insert(messages).values({
      channelId,
      isSystem: true,
      systemType: 'project_update',
      bodyText,
      createdAt: now,
      updatedAt: now,
    }).returning();

    // Broadcast to connected clients
    const io = getIO();
    if (io) {
      // Create a hydrated message object similar to what the frontend expects
      const populatedMessage = {
        messageId: msg.messageId,
        channelId: msg.channelId,
        authorId: msg.authorId,
        authorName: 'DevSync Bot',
        authorAvatar: null,
        isSystem: msg.isSystem,
        systemType: msg.systemType,
        bodyText: msg.bodyText,
        threadId: msg.threadId,
        replyCount: msg.replyCount,
        isEdited: msg.isEdited,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      };
      io.to(`channel:${channelId}`).emit('new_message', populatedMessage);
    }
  }
};

// ─── HELPER: Validate Task Relations ─────────────────────────────────────────
const validateTaskRelations = async (tx: any, projectId: string, relations: { assigneeId?: string | null, parentTaskId?: string | null, epicId?: string | null, sprintId?: string | null }) => {
  if (relations.assigneeId) {
    const [member] = await tx.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, relations.assigneeId))).limit(1);
    if (!member) throw new Error('INVALID_ASSIGNEE');
  }
  if (relations.parentTaskId) {
    const [parent] = await tx.select().from(tasks).where(and(eq(tasks.taskId, relations.parentTaskId), eq(tasks.projectId, projectId))).limit(1);
    if (!parent) throw new Error('INVALID_PARENT_TASK');
  }
  if (relations.epicId) {
    const [epic] = await tx.select().from(tasks).where(and(eq(tasks.taskId, relations.epicId), eq(tasks.projectId, projectId), eq(tasks.issueType, 'epic'))).limit(1);
    if (!epic) throw new Error('INVALID_EPIC');
  }
  if (relations.sprintId) {
    const [sprint] = await tx.select().from(sprints).where(and(eq(sprints.sprintId, relations.sprintId), eq(sprints.projectId, projectId))).limit(1);
    if (!sprint) throw new Error('INVALID_SPRINT');
  }
};

// ─── CREATE TASK ─────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/tasks
export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const {
      title, description, descriptionText, issueType,
      status, priority, assigneeId, dueDate, labels,
      parentTaskId, epicId, sprintId,
    } = req.body;

    const result = await db.transaction(async (tx) => {
      // 1. Atomically increment the project's issue counter to generate task key
      const [project] = await tx
        .update(projects)
        .set({ issueCounter: sql`issue_counter + 1`, updatedAt: new Date() })
        .where(eq(projects.projectId, projectId))
        .returning({ issueCounter: projects.issueCounter, key: projects.key, workspaceId: projects.workspaceId });

      if (!project) {
        throw new Error('PROJECT_NOT_FOUND');
      }

      await validateTaskRelations(tx, projectId, { assigneeId, parentTaskId, epicId, sprintId });

      const taskKey = `${project.key}-${project.issueCounter}`;

      // 2. Determine rank — place at end of the target status column
      const targetStatus = status || 'todo';
      const [lastTask] = await tx
        .select({ rank: tasks.rank })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.status, targetStatus),
            isNull(tasks.deletedAt)
          )
        )
        .orderBy(desc(tasks.rank))
        .limit(1);

      let rank: string;
      if (!lastTask || !lastTask.rank) {
        rank = generateKeyBetween(null, null);
      } else {
        rank = generateKeyBetween(lastTask.rank, null);
      }

      // 3. Create the root message for the task's discussion thread
      const [rootMessage] = await tx
        .insert(messages)
        .values({
          authorId: userId,
          isSystem: true,
          systemType: 'task_thread_root',
          bodyText: `Task thread root for ${taskKey}`,
        })
        .returning();

      // 4. Create the system message "User created this task"
      const [creator] = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.userId, userId));
      await tx.insert(messages).values({
        authorId: userId,
        isSystem: true,
        systemType: 'task_created',
        bodyText: `${creator?.fullName || 'System'} created this task`,
        threadId: rootMessage.messageId,
      });

      // 5. Insert the task
      const [task] = await tx
        .insert(tasks)
        .values({
          taskKey,
          projectId,
          title: title.trim(),
          description: description || {},
          descriptionText: descriptionText || '',
          issueType: issueType || 'task',
          status: targetStatus,
          priority: priority || 'medium',
          reporterId: userId,
          assigneeId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          labels: labels || [],
          rank,
          parentTaskId: parentTaskId || null,
          epicId: epicId || null,
          sprintId: sprintId || null,
          discussionThreadId: rootMessage.messageId,
        })
        .returning();

      // 6. Write audit log
      await logAuditAction({
        actorId: userId,
        action: 'task.created',
        entityType: 'task',
        entityId: task.taskId,
        workspaceId: project.workspaceId ?? undefined,
        newValues: { task_key: task.taskKey, title: task.title, type: task.issueType, status: task.status, priority: task.priority, reporter_id: task.reporterId, project_id: task.projectId },
        tx
      });

      // 7. Broadcast to project channels
      await broadcastToProjectChannels(tx, projectId, `✅ **${creator?.fullName || 'User'}** created task @${task.taskKey}: ${task.title}`);

      return task;
    });

    if (result.assigneeId && result.assigneeId !== userId) {
      const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, userId));
      await createNotification({
        recipientId: result.assigneeId,
        actorId: userId,
        type: 'task_assigned',
        entityType: 'task',
        entityId: result.taskId,
        title: `You were assigned ${result.taskKey}`,
        body: `${actor?.name || 'Someone'} assigned you to '${result.title}'`,
      });
    }

    if (result.descriptionText) {
      await notifyTaskMentions(result.descriptionText, userId, result.taskId, result.taskKey, projectId);
    }

    res.status(201).json({ message: 'Task created', task: result });
  } catch (err: any) {
    if (err.message === 'PROJECT_NOT_FOUND') { res.status(404).json({ error: 'Project not found.' }); return; }
    if (err.message === 'INVALID_ASSIGNEE') { res.status(400).json({ error: 'Assignee is not a member of this project.' }); return; }
    if (err.message === 'INVALID_PARENT_TASK') { res.status(400).json({ error: 'Parent task does not exist in this project.' }); return; }
    if (err.message === 'INVALID_EPIC') { res.status(400).json({ error: 'Epic does not exist in this project or is not an epic.' }); return; }
    if (err.message === 'INVALID_SPRINT') { res.status(400).json({ error: 'Sprint does not exist in this project.' }); return; }

    console.error('Create task error:', err);
    res.status(500).json({ error: 'Server error creating task.' });
  }
};

// ─── LIST TASKS (Board View) ─────────────────────────────────────────────────
// GET /api/projects/:projectId/tasks
export const listTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId || res.locals.projectId;
    const { status, assigneeId, sprintId, issueType, search } = req.query;

    let conditions = [eq(tasks.projectId, projectId), isNull(tasks.deletedAt)];

    if (status && typeof status === 'string') {
      conditions.push(eq(tasks.status, status));
    }
    if (assigneeId && typeof assigneeId === 'string') {
      conditions.push(eq(tasks.assigneeId, assigneeId));
    }
    if (sprintId && typeof sprintId === 'string') {
      conditions.push(eq(tasks.sprintId, sprintId));
    }
    if (issueType && typeof issueType === 'string') {
      conditions.push(eq(tasks.issueType, issueType));
    }

    // Build WHERE clause
    let whereClause = and(...conditions);

    // Text search using ILIKE on title (simple), or TSVECTOR for description
    if (search && typeof search === 'string') {
      const searchCondition = or(
        ilike(tasks.title, `%${search}%`),
        ilike(tasks.descriptionText, `%${search}%`)
      );
      whereClause = and(whereClause, searchCondition);
    }

    const results = await db
      .select({
        taskId: tasks.taskId,
        taskKey: tasks.taskKey,
        title: tasks.title,
        issueType: tasks.issueType,
        status: tasks.status,
        priority: tasks.priority,
        rank: tasks.rank,
        dueDate: tasks.dueDate,
        labels: tasks.labels,
        sprintId: tasks.sprintId,
        assigneeId: tasks.assigneeId,
        assigneeName: users.fullName,
        assigneeAvatar: users.avatarUrl,
        reporterId: tasks.reporterId,
        linkedCommitsCount: tasks.linkedCommitsCount,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.userId))
      .where(whereClause)
      .orderBy(asc(tasks.rank));

    res.json({ tasks: results });
  } catch (err) {
    console.error('List tasks error:', err);
    res.status(500).json({ error: 'Server error listing tasks.' });
  }
};

// ─── GET SINGLE TASK ─────────────────────────────────────────────────────────
// GET /api/projects/:projectId/tasks/:taskId
export const getTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.taskId || res.locals.taskId;

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.taskId, taskId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    res.json({ task });
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ error: 'Server error fetching task.' });
  }
};

// ─── UPDATE TASK ─────────────────────────────────────────────────────────────
// PATCH /api/projects/:projectId/tasks/:taskId
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.taskId || res.locals.taskId;
    const {
      title, description, descriptionText, issueType,
      status, priority, assigneeId, dueDate, labels,
      parentTaskId, epicId, sprintId,
    } = req.body;

    const [oldTask] = await db.select().from(tasks).where(eq(tasks.taskId, taskId)).limit(1);

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (descriptionText !== undefined) updateData.descriptionText = descriptionText;
    if (issueType !== undefined) updateData.issueType = issueType;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (labels !== undefined) updateData.labels = labels;
    if (parentTaskId !== undefined) updateData.parentTaskId = parentTaskId || null;
    if (epicId !== undefined) updateData.epicId = epicId || null;
    if (sprintId !== undefined) updateData.sprintId = sprintId || null;

    const result = await db.transaction(async (tx) => {
      await validateTaskRelations(tx, oldTask.projectId as string, { assigneeId, parentTaskId, epicId, sprintId });

      const [updated] = await tx
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.taskId, taskId), isNull(tasks.deletedAt)))
        .returning();

      if (!updated) return null;

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, updated.projectId!));
      const workspaceId = project?.workspaceId ?? undefined;

      if (oldTask) {
        const actorId = req.user!.userId;
        const eType = 'task';
        const eId = updated.taskId;

        if (oldTask.title !== updated.title) {
          await logAuditAction({
            actorId, action: 'task.title_changed', entityType: eType, entityId: eId, workspaceId,
            newValues: { title: updated.title }, oldValues: { title: oldTask.title }, tx
          });
        }
        if (oldTask.descriptionText !== updated.descriptionText) {
          await logAuditAction({
            actorId, action: 'task.description_changed', entityType: eType, entityId: eId, workspaceId,
            newValues: { description_text: updated.descriptionText }, oldValues: { description_text: oldTask.descriptionText }, tx
          });
        }
        if (oldTask.status !== updated.status) {
          await logAuditAction({
            actorId, action: 'task.status_changed', entityType: eType, entityId: eId, workspaceId,
            newValues: { status: updated.status }, oldValues: { status: oldTask.status }, tx
          });
        }
        if (oldTask.priority !== updated.priority) {
          await logAuditAction({
            actorId, action: 'task.priority_changed', entityType: eType, entityId: eId, workspaceId,
            newValues: { priority: updated.priority }, oldValues: { priority: oldTask.priority }, tx
          });
        }
        if (oldTask.issueType !== updated.issueType) {
          await logAuditAction({
            actorId, action: 'task.type_changed', entityType: eType, entityId: eId, workspaceId,
            newValues: { issue_type: updated.issueType }, oldValues: { issue_type: oldTask.issueType }, tx
          });
        }
        if (oldTask.assigneeId !== updated.assigneeId) {
          let oldAssigneeName = null, newAssigneeName = null;
          if (oldTask.assigneeId) {
            const [u] = await tx.select({ name: users.fullName }).from(users).where(eq(users.userId, oldTask.assigneeId));
            if (u) oldAssigneeName = u.name;
          }
          if (updated.assigneeId) {
            const [u] = await tx.select({ name: users.fullName }).from(users).where(eq(users.userId, updated.assigneeId));
            if (u) newAssigneeName = u.name;
          }
          await logAuditAction({
            actorId, action: updated.assigneeId ? 'task.assignee_changed' : 'task.assignee_removed',
            entityType: eType, entityId: eId, workspaceId,
            newValues: { assignee_id: updated.assigneeId, assignee_name: newAssigneeName },
            oldValues: { assignee_id: oldTask.assigneeId, assignee_name: oldAssigneeName }, tx
          });
        }
        const oldDue = oldTask.dueDate ? oldTask.dueDate.toISOString().split('T')[0] : null;
        const newDue = updated.dueDate ? updated.dueDate.toISOString().split('T')[0] : null;
        if (oldDue !== newDue) {
          await logAuditAction({
            actorId, action: newDue ? 'task.due_date_changed' : 'task.due_date_removed',
            entityType: eType, entityId: eId, workspaceId,
            newValues: { due_date: newDue }, oldValues: { due_date: oldDue }, tx
          });
        }
        const oldLabels = JSON.stringify(oldTask.labels || []);
        const newLabels = JSON.stringify(updated.labels || []);
        if (oldLabels !== newLabels) {
          await logAuditAction({
            actorId, action: 'task.labels_changed', entityType: eType, entityId: eId, workspaceId,
            newValues: { labels: updated.labels || [] }, oldValues: { labels: oldTask.labels || [] }, tx
          });
        }
        if (oldTask.sprintId !== updated.sprintId) {
          let oldSprintName = null, newSprintName = null;
          if (oldTask.sprintId) {
            const [s] = await tx.select({ name: sprints.name }).from(sprints).where(eq(sprints.sprintId, oldTask.sprintId));
            if (s) oldSprintName = s.name;
          }
          if (updated.sprintId) {
            const [s] = await tx.select({ name: sprints.name }).from(sprints).where(eq(sprints.sprintId, updated.sprintId));
            if (s) newSprintName = s.name;
          }
          await logAuditAction({
            actorId, action: updated.sprintId ? 'task.sprint_changed' : 'task.moved_to_backlog',
            entityType: eType, entityId: eId, workspaceId,
            newValues: { sprint_id: updated.sprintId, sprint_name: newSprintName },
            oldValues: { sprint_id: oldTask.sprintId, sprint_name: oldSprintName }, tx
          });
        }
        if (oldTask.parentTaskId !== updated.parentTaskId) {
          let oldParentKey = null, newParentKey = null;
          if (oldTask.parentTaskId) {
            const [t] = await tx.select({ key: tasks.taskKey }).from(tasks).where(eq(tasks.taskId, oldTask.parentTaskId));
            if (t) oldParentKey = t.key;
          }
          if (updated.parentTaskId) {
            const [t] = await tx.select({ key: tasks.taskKey }).from(tasks).where(eq(tasks.taskId, updated.parentTaskId));
            if (t) newParentKey = t.key;
          }
          await logAuditAction({
            actorId, action: updated.parentTaskId ? 'task.parent_set' : 'task.parent_removed',
            entityType: eType, entityId: eId, workspaceId,
            newValues: { parent_task_id: updated.parentTaskId, parent_task_key: newParentKey },
            oldValues: { parent_task_id: oldTask.parentTaskId, parent_task_key: oldParentKey }, tx
          });
        }
        if (oldTask.epicId !== updated.epicId) {
          let oldEpicKey = null, newEpicKey = null;
          if (oldTask.epicId) {
            const [t] = await tx.select({ key: tasks.taskKey }).from(tasks).where(eq(tasks.taskId, oldTask.epicId));
            if (t) oldEpicKey = t.key;
          }
          if (updated.epicId) {
            const [t] = await tx.select({ key: tasks.taskKey }).from(tasks).where(eq(tasks.taskId, updated.epicId));
            if (t) newEpicKey = t.key;
          }
          await logAuditAction({
            actorId, action: updated.epicId ? 'task.epic_set' : 'task.epic_removed',
            entityType: eType, entityId: eId, workspaceId,
            newValues: { epic_id: updated.epicId, epic_key: newEpicKey },
            oldValues: { epic_id: oldTask.epicId, epic_key: oldEpicKey }, tx
          });
        }
      }

      // --- BROADCAST TO CHANNELS ---
      let broadcastMessage = '';
      if (oldTask) {
        const actorId = req.user!.userId;
        const [actor] = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.userId, actorId));
        const actorName = actor?.fullName || 'User';

        if (oldTask.status !== updated.status) {
          broadcastMessage = `🔄 **${actorName}** moved @${updated.taskKey} to ${updated.status}`;
          // Also add a system message to the task thread
          await tx.insert(messages).values({
            authorId: actorId,
            isSystem: true,
            systemType: 'task_status_changed',
            bodyText: `${actorName} changed status to ${updated.status}`,
            threadId: updated.discussionThreadId,
          });
        } else if (oldTask.assigneeId !== updated.assigneeId) {
          if (updated.assigneeId) {
            const [assignee] = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.userId, updated.assigneeId));
            broadcastMessage = `👤 **${actorName}** assigned @${updated.taskKey} to ${assignee?.fullName || 'Someone'}`;
          } else {
            broadcastMessage = `👤 **${actorName}** unassigned @${updated.taskKey}`;
          }
        }
        
        if (broadcastMessage && updated.projectId) {
          await broadcastToProjectChannels(tx, updated.projectId, broadcastMessage);
        }
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    // --- NOTIFICATIONS ---
    const actorId = req.user!.userId;
    if (oldTask) {
      // Assignee changed
      if (oldTask.assigneeId !== result.assigneeId) {
        if (result.assigneeId && result.assigneeId !== actorId) {
          const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));
          await createNotification({
            recipientId: result.assigneeId,
            actorId,
            type: 'task_assigned',
            entityType: 'task',
            entityId: result.taskId,
            title: `You were assigned @${result.taskKey}`,
            body: `${actor?.name || 'Someone'} assigned you to '${result.title}'`,
          });
        }
        if (oldTask.assigneeId && oldTask.assigneeId !== actorId) {
          const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));
          await createNotification({
            recipientId: oldTask.assigneeId,
            actorId,
            type: 'task_unassigned',
            entityType: 'task',
            entityId: result.taskId,
            title: `You were unassigned from @${result.taskKey}`,
            body: `${actor?.name || 'Someone'} removed you from '${result.title}'`,
          });
        }
      }

      // Status changed
      if (oldTask.status !== result.status) {
        const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));
        const formatStatus = (s: string) => s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        const notifyStatus = async (recipient: string | null) => {
          if (recipient && recipient !== actorId) {
            await createNotification({
              recipientId: recipient,
              actorId,
              type: 'task_status_changed',
              entityType: 'task',
              entityId: result.taskId,
              title: `@${result.taskKey} moved to ${formatStatus(result.status as string)}`,
              body: `${actor?.name || 'Someone'} changed '${result.title}' from ${formatStatus(oldTask.status as string)} to ${formatStatus(result.status as string)}`,
            });
          }
        };
        await notifyStatus(result.assigneeId);
        if (result.reporterId !== result.assigneeId) {
           await notifyStatus(result.reporterId);
        }
      }

      // Mentions in description
      if (oldTask.descriptionText !== result.descriptionText && result.descriptionText) {
        await notifyTaskMentions(result.descriptionText, actorId, result.taskId, result.taskKey, result.projectId as string);
      }
    }

    res.json({ message: 'Task updated', task: result });
  } catch (err: any) {
    if (err.message === 'INVALID_ASSIGNEE') { res.status(400).json({ error: 'Assignee is not a member of this project.' }); return; }
    if (err.message === 'INVALID_PARENT_TASK') { res.status(400).json({ error: 'Parent task does not exist in this project.' }); return; }
    if (err.message === 'INVALID_EPIC') { res.status(400).json({ error: 'Epic does not exist in this project or is not an epic.' }); return; }
    if (err.message === 'INVALID_SPRINT') { res.status(400).json({ error: 'Sprint does not exist in this project.' }); return; }

    console.error('Update task error:', err);
    res.status(500).json({ error: 'Server error updating task.' });
  }
};

// ─── REORDER TASK (Drag & Drop) ──────────────────────────────────────────────
// PATCH /api/projects/:projectId/tasks/:taskId/reorder
export const reorderTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.taskId || res.locals.taskId;
    const { status, afterTaskId, beforeTaskId } = req.body;

    // Get ranks of surrounding tasks to calculate new rank
    let afterRank = '';
    let beforeRank = '';

    if (afterTaskId) {
      const [after] = await db
        .select({ rank: tasks.rank })
        .from(tasks)
        .where(eq(tasks.taskId, afterTaskId))
        .limit(1);
      if (after?.rank) afterRank = after.rank;
    }

    if (beforeTaskId) {
      const [before] = await db
        .select({ rank: tasks.rank })
        .from(tasks)
        .where(eq(tasks.taskId, beforeTaskId))
        .limit(1);
      if (before?.rank) beforeRank = before.rank;
    }

    // Generate new rank using fractional-indexing (true LexoRank)
    // afterRank is the task above it, beforeRank is the task below it
    const newRank = generateKeyBetween(afterRank || null, beforeRank || null);

    const updateData: Record<string, any> = { rank: newRank, updatedAt: new Date() };
    if (status) updateData.status = status;

    const result = await db.transaction(async (tx) => {
      const [oldTask] = await tx.select().from(tasks).where(eq(tasks.taskId, taskId)).limit(1);

      const [updated] = await tx
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.taskId, taskId))
        .returning({ taskId: tasks.taskId, rank: tasks.rank, status: tasks.status, projectId: tasks.projectId });

      if (!updated || !oldTask) return null;

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, updated.projectId!));
      const workspaceId = project?.workspaceId ?? undefined;

      if (oldTask.rank !== updated.rank) {
        await logAuditAction({
          actorId: req.user!.userId,
          action: 'task.rank_changed',
          entityType: 'task',
          entityId: updated.taskId,
          workspaceId,
          newValues: { rank: updated.rank },
          oldValues: { rank: oldTask.rank },
          tx
        });
      }
      if (oldTask.status !== updated.status) {
        await logAuditAction({
          actorId: req.user!.userId,
          action: 'task.status_changed',
          entityType: 'task',
          entityId: updated.taskId,
          workspaceId,
          newValues: { status: updated.status },
          oldValues: { status: oldTask.status },
          tx
        });
      }

      return {
        updated,
        oldStatus: oldTask.status,
        title: oldTask.title,
        taskKey: oldTask.taskKey,
        assigneeId: oldTask.assigneeId,
        reporterId: oldTask.reporterId
      };
    });

    if (!result) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    // --- NOTIFICATIONS ---
    const actorId = req.user!.userId;
    if (result.oldStatus !== result.updated.status) {
      const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));
      const formatStatus = (s: string) => s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      const notifyStatus = async (recipient: string | null) => {
        if (recipient && recipient !== actorId) {
          await createNotification({
            recipientId: recipient,
            actorId,
            type: 'task_status_changed',
            entityType: 'task',
            entityId: result.updated.taskId,
            title: `@${result.taskKey} moved to ${formatStatus(result.updated.status as string)}`,
            body: `${actor?.name || 'Someone'} changed '${result.title}' from ${formatStatus(result.oldStatus as string)} to ${formatStatus(result.updated.status as string)}`,
          });
        }
      };
      await notifyStatus(result.assigneeId);
      if (result.reporterId !== result.assigneeId) {
         await notifyStatus(result.reporterId);
      }
    }

    res.json({ message: 'Task reordered', task: result.updated });
  } catch (err) {
    console.error('Reorder task error:', err);
    res.status(500).json({ error: 'Server error reordering task.' });
  }
};

// ─── SOFT DELETE TASK ────────────────────────────────────────────────────────
// DELETE /api/projects/:projectId/tasks/:taskId
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.taskId || res.locals.taskId;

    const result = await db.transaction(async (tx) => {
      const [oldTask] = await tx.select().from(tasks).where(and(eq(tasks.taskId, taskId), isNull(tasks.deletedAt))).limit(1);
      if (!oldTask) return null;

      const [deleted] = await tx
        .update(tasks)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(tasks.taskId, taskId))
        .returning({ taskId: tasks.taskId, deletedAt: tasks.deletedAt });

      const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, oldTask.projectId!));
      
      await logAuditAction({
        actorId: req.user!.userId,
        action: 'task.deleted',
        entityType: 'task',
        entityId: deleted.taskId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: { deleted_at: deleted.deletedAt?.toISOString() },
        oldValues: { task_key: oldTask.taskKey, title: oldTask.title, status: oldTask.status },
        tx
      });

      return deleted;
    });

    if (!result) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Server error deleting task.' });
  }
};

// ─── GET TASK COMMENTS (Using Messages Thread) ─────────────────────────────────
// GET /api/projects/:projectId/tasks/:taskKey/comments
export const getTaskComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = res.locals.taskId;

    // Fetch the task to get its discussionThreadId
    const [task] = await db.select({ discussionThreadId: tasks.discussionThreadId }).from(tasks).where(eq(tasks.taskId, taskId));
    
    if (!task || !task.discussionThreadId) {
      res.json({ comments: [] });
      return;
    }

    const comments = await db
      .select({
        commentId: messages.messageId,
        threadId: messages.threadId,
        bodyText: messages.bodyText,
        createdAt: messages.createdAt,
        isSystem: messages.isSystem,
        systemType: messages.systemType,
        authorId: users.userId,
        authorName: users.fullName,
      })
      .from(messages)
      .leftJoin(users, eq(users.userId, messages.authorId))
      .where(eq(messages.threadId, task.discussionThreadId))
      .orderBy(asc(messages.createdAt));

    res.json({ comments });
  } catch (err) {
    console.error('Get task comments error:', err);
    res.status(500).json({ error: 'Server error fetching comments.' });
  }
};

// ─── CREATE TASK COMMENT (Using Messages Thread) ───────────────────────────────
// POST /api/projects/:projectId/tasks/:taskKey/comments
export const createTaskComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = res.locals.taskId;
    const userId = req.user!.userId;
    const { bodyText } = req.body;

    if (!bodyText || bodyText.trim().length === 0) {
      res.status(400).json({ error: 'Comment body cannot be empty.' });
      return;
    }

    // Fetch the task to get its discussionThreadId
    const [task] = await db.select({ discussionThreadId: tasks.discussionThreadId }).from(tasks).where(eq(tasks.taskId, taskId));
    
    if (!task || !task.discussionThreadId) {
      res.status(400).json({ error: 'Task does not have a discussion thread.' });
      return;
    }

    const [comment] = await db
      .insert(messages)
      .values({
        threadId: task.discussionThreadId,
        authorId: userId,
        bodyText,
        isSystem: false,
      })
      .returning();

    // Fetch author details to return in the response
    const [author] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.userId, userId));

    res.status(201).json({
      comment: {
        commentId: comment.messageId,
        threadId: comment.threadId,
        bodyText: comment.bodyText,
        createdAt: comment.createdAt,
        isSystem: comment.isSystem,
        systemType: comment.systemType,
        authorId: comment.authorId,
        authorName: author?.fullName,
      }
    });
  } catch (err) {
    console.error('Create task comment error:', err);
    res.status(500).json({ error: 'Server error creating comment.' });
  }
};

// ─── HELPER: NOTIFY MENTIONS ─────────────────────────────────────────────────
const notifyTaskMentions = async (text: string, actorId: string, taskId: string, taskKey: string, projectId: string) => {
  let mentionedIds: string[] = [];

  // HTML Mentions
  const spanRegex = /<[^>]+>/g;
  const tagMatches = [...text.matchAll(spanRegex)];
  for (const match of tagMatches) {
    const tag = match[0];
    if (tag.includes('data-type="mention"')) {
      const idMatch = tag.match(/data-id="([^"]+)"/);
      if (idMatch) mentionedIds.push(idMatch[1]);
    }
  }

  // Plain Text Mentions (fallback for simple textareas)
  const plainRegex = /@([a-zA-Z0-9_-]+)/g;
  const plainMatches = [...text.matchAll(plainRegex)];
  const usernames = [...new Set(plainMatches.map(m => m[1]))];

  for (const username of usernames) {
    if (['all', 'everyone', 'channel'].includes(username.toLowerCase())) {
      const allProjectMembers = await db.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, projectId));
      mentionedIds.push(...(allProjectMembers.map(m => m.userId).filter(Boolean) as string[]));
      continue;
    }
    const [mentionedUser] = await db
      .select({ id: users.userId })
      .from(users)
      .where(or(ilike(users.displayName, username), ilike(users.fullName, username + '%')))
      .limit(1);
    if (mentionedUser) mentionedIds.push(mentionedUser.id);
  }

  // Deduplicate
  mentionedIds = [...new Set(mentionedIds)];

  if (mentionedIds.length === 0) return;

  const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));

  for (const mentionedId of mentionedIds) {
    if (mentionedId !== actorId) {
      await createNotification({
        recipientId: mentionedId,
        actorId,
        type: 'task_mentioned',
        entityType: 'task',
        entityId: taskId,
        title: `${actor?.name || 'Someone'} mentioned you in ${taskKey}`,
        body: `'${(text || '').replace(/<[^>]*>?/gm, '').substring(0, 100)}...'`,
      });
    }
  }
};
