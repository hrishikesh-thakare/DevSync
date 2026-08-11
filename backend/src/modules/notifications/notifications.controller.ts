import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { notifications } from '../../db/schema/notifications.js';
import { users } from '../../db/schema/auth.js';
import { messages, channels } from '../../db/schema/channels.js';
import { tasks } from '../../db/schema/tasks.js';
import { sprints } from '../../db/schema/sprints.js';
import { projects } from '../../db/schema/projects.js';
import { workspaces } from '../../db/schema/workspaces.js';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { getIO } from '../../sockets/index.js';

// ─── INTERNAL HELPER: Create a notification ──────────────────────────────────
export const createNotification = async (params: {
  recipientId: string;
  actorId?: string;
  type: string;
  entityType: string;
  entityId: string;
  title?: string;
  body?: string;
}) => {
  try {
    // Don't notify oneself
    if (params.actorId && params.actorId === params.recipientId) {
      return null;
    }

    // Check user preferences
    const [recipient] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.userId, params.recipientId));
    const prefs = (recipient?.preferences as any) || {};

    const isMention = params.type === 'channel_mentioned' || params.type === 'task_mentioned';
    if (prefs.notifyOnlyMentions && !isMention) {
      return null; // Skip if user only wants mentions
    }

    const isGitHubEvent = params.entityType === 'github' || params.type.includes('ci') || params.type.includes('commit') || params.type.includes('pr_');
    if (prefs.muteGithubBot && isGitHubEvent) {
      return null; // Skip if user muted GitHub bot
    }


    const [notification] = await db
      .insert(notifications)
      .values({
        recipientId: params.recipientId,
        actorId: params.actorId || null,
        type: params.type,
        entityType: params.entityType,
        entityId: params.entityId,
        title: params.title || null,
        body: params.body || null,
      })
      .returning();

    // Populate extra fields for real-time emit
    let actorName = null;
    let actorAvatar = null;
    let channelId = null;

    if (params.actorId) {
      const [actor] = await db.select({ fullName: users.fullName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.userId, params.actorId));
      if (actor) {
        actorName = actor.fullName;
        actorAvatar = actor.avatarUrl;
      }
    }

    if (params.entityType === 'message') {
      const [message] = await db.select({ channelId: messages.channelId }).from(messages).where(eq(messages.messageId, params.entityId));
      if (message) {
        channelId = message.channelId;
      }
    }

    const populatedNotification = {
      ...notification,
      actorId: params.actorId || null,
      actorName,
      actorAvatar,
      channelId,
    };

    // Emit real-time event to the recipient
    const io = getIO();
    io.to(`user:${params.recipientId}`).emit('new_notification', populatedNotification);

    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
};

// ─── GET MY NOTIFICATIONS ────────────────────────────────────────────────────
// GET /api/notifications
export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { unreadOnly, limit = 50 } = req.query;

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);

    let conditions = [eq(notifications.recipientId, userId)];
    
    if (unreadOnly === 'true') {
      conditions.push(eq(notifications.isRead, false));
    }

    const results = await db
      .select({
        notificationId: notifications.notificationId,
        type: notifications.type,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        title: notifications.title,
        body: notifications.body,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorId: users.userId,
        actorName: users.fullName,
        actorAvatar: users.avatarUrl,
        channelId: messages.channelId, // Include channelId for message-related notifications
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.userId))
      .leftJoin(messages, eq(notifications.entityId, messages.messageId))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(parsedLimit);

    res.json({ notifications: results });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error fetching notifications.' });
  }
};

// ─── MARK AS READ ────────────────────────────────────────────────────────────
// PATCH /api/notifications/:notificationId/read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.params as Record<string, string>;
    const userId = req.user!.userId;

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.recipientId, userId)
        )
      )
      .returning({ notificationId: notifications.notificationId });

    if (!updated) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ error: 'Server error marking notification as read.' });
  }
};

// ─── MARK ALL AS READ ────────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        )
      );

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all as read error:', err);
    res.status(500).json({ error: 'Server error marking all notifications as read.' });
  }
};

// ─── RESOLVE NOTIFICATION URL ────────────────────────────────────────────────
// GET /api/notifications/:notificationId/resolve
export const resolveNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.params as Record<string, string>;
    const userId = req.user!.userId;

    const [notif] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.notificationId, notificationId), eq(notifications.recipientId, userId)));

    if (!notif) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }

    let url = '/workspaces'; // Fallback

    const isGitHubEvent = notif.type.includes('ci') || notif.type.includes('commit') || notif.type.includes('pr_') || notif.entityType === 'github';
    const isSprintEvent = notif.entityType === 'sprint' || notif.type.includes('sprint');

    if (isGitHubEvent) {
      let targetTab: 'prs' | 'issues' | 'ci' | 'commits' = 'prs';
      if (notif.type.includes('ci')) {
        targetTab = 'ci';
      } else if (notif.type.includes('commit')) {
        targetTab = 'commits';
      } else if (notif.type.includes('pr_')) {
        targetTab = 'prs';
      } else if (notif.type.includes('issue_')) {
        targetTab = 'issues';
      }

      if (notif.entityType === 'task') {
        const [task] = await db
          .select({ projectKey: projects.key, slug: workspaces.slug })
          .from(tasks)
          .leftJoin(projects, eq(tasks.projectId, projects.projectId))
          .leftJoin(workspaces, eq(projects.workspaceId, workspaces.workspaceId))
          .where(eq(tasks.taskId, notif.entityId));
        if (task && task.slug && task.projectKey) {
          url = `/w/${task.slug}/projects/${task.projectKey}/github?tab=${targetTab}`;
        }
      } else {
        const [project] = await db
          .select({ key: projects.key, slug: workspaces.slug })
          .from(projects)
          .leftJoin(workspaces, eq(projects.workspaceId, workspaces.workspaceId))
          .where(eq(projects.projectId, notif.entityId));
        if (project && project.slug && project.key) {
          url = `/w/${project.slug}/projects/${project.key}/github?tab=${targetTab}`;
        }
      }
    } else if (isSprintEvent) {
      const [sprint] = await db
        .select({ sprintId: sprints.sprintId, projectKey: projects.key, slug: workspaces.slug })
        .from(sprints)
        .leftJoin(projects, eq(sprints.projectId, projects.projectId))
        .leftJoin(workspaces, eq(projects.workspaceId, workspaces.workspaceId))
        .where(eq(sprints.sprintId, notif.entityId));
      if (sprint && sprint.slug && sprint.projectKey) {
        if (notif.type === 'sprint_closed') {
          url = `/w/${sprint.slug}/projects/${sprint.projectKey}/sprints`;
        } else {
          url = `/w/${sprint.slug}/projects/${sprint.projectKey}/sprints/${sprint.sprintId}`;
        }
      } else {
        // Fallback for older sprint notifications where entityId might have been projectId
        const [project] = await db
          .select({ key: projects.key, slug: workspaces.slug })
          .from(projects)
          .leftJoin(workspaces, eq(projects.workspaceId, workspaces.workspaceId))
          .where(eq(projects.projectId, notif.entityId));
        if (project && project.slug && project.key) {
          url = `/w/${project.slug}/projects/${project.key}/sprints`;
        }
      }
    } else {
      const isMentionOrChatMessage = notif.entityType === 'message' || ['channel_mentioned', 'dm_received', 'task_mentioned'].includes(notif.type);

      if (isMentionOrChatMessage) {
        const [msg] = await db
          .select({ channelId: messages.channelId, slug: workspaces.slug })
          .from(messages)
          .leftJoin(channels, eq(messages.channelId, channels.channelId))
          .leftJoin(workspaces, eq(channels.workspaceId, workspaces.workspaceId))
          .where(eq(messages.messageId, notif.entityId));
        if (msg && msg.slug && msg.channelId) {
          url = `/w/${msg.slug}/channels/${msg.channelId}?messageId=${notif.entityId}`;
        }
      }

      if (url === '/workspaces' && (notif.entityType === 'task' || notif.type.includes('task'))) {
        const [task] = await db
          .select({ taskId: tasks.taskId, taskKey: tasks.taskKey, projectKey: projects.key, slug: workspaces.slug })
          .from(tasks)
          .leftJoin(projects, eq(tasks.projectId, projects.projectId))
          .leftJoin(workspaces, eq(projects.workspaceId, workspaces.workspaceId))
          .where(eq(tasks.taskId, notif.entityId));

        if (task && task.slug && task.projectKey && task.taskKey) {
          // Check if there is a message in chat mentioning this taskKey (for backward compatibility with old notifications)
          const [msg] = await db
            .select({ channelId: messages.channelId, messageId: messages.messageId, slug: workspaces.slug })
            .from(messages)
            .leftJoin(channels, eq(messages.channelId, channels.channelId))
            .leftJoin(workspaces, eq(channels.workspaceId, workspaces.workspaceId))
            .where(ilike(messages.bodyText, `%${task.taskKey}%`))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          if (msg && msg.slug && msg.channelId && msg.messageId) {
            url = `/w/${msg.slug}/channels/${msg.channelId}?messageId=${msg.messageId}`;
          } else {
            url = `/w/${task.slug}/projects/${task.projectKey}/tasks/${task.taskKey}`;
          }
        }
      } else if (url === '/workspaces' && notif.entityType === 'project') {
        const [project] = await db
          .select({ key: projects.key, slug: workspaces.slug })
          .from(projects)
          .leftJoin(workspaces, eq(projects.workspaceId, workspaces.workspaceId))
          .where(eq(projects.projectId, notif.entityId));
        if (project && project.slug && project.key) {
          url = `/w/${project.slug}/projects/${project.key}`;
        }
      }
    }

    res.json({ url });
  } catch (err) {
    console.error('Resolve notification error:', err);
    res.status(500).json({ error: 'Server error resolving notification.' });
  }
};
