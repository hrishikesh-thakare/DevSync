import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { sql } from 'drizzle-orm';
import { workspaces, workspaceMembers } from '../../db/schema/workspaces.js';
import { projectMembers, projects } from '../../db/schema/projects.js';
import { channelMembers, channels, messages } from '../../db/schema/channels.js';
import { users } from '../../db/schema/auth.js';
import { eq, and, inArray, isNull, or, ilike, desc, gte, lte } from 'drizzle-orm';
import { tasks } from '../../db/schema/tasks.js';

// ─── FULL TEXT SEARCH (Tasks & Messages) ─────────────────────────────────────
// GET /api/workspaces/:slug/search?q=...&type=all&limit=25&offset=0
//   Task filters:   projectId, status, assigneeId, priority
//   Message filters: channelId, dateFrom, dateTo
export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    let workspaceId = req.params.workspaceId || res.locals.workspaceId;
    const slug = req.params.slug;

    if (!workspaceId && slug) {
      const [ws] = await db
        .select({ workspaceId: workspaces.workspaceId })
        .from(workspaces)
        .where(eq(workspaces.slug, slug as string))
        .limit(1);
      if (ws) {
        workspaceId = ws.workspaceId;
      }
    }
    const {
      q,
      type = 'all',
      limit: limitStr = '25',
      offset: offsetStr = '0',
      // Task filters
      projectId: filterProjectId,
      status: filterStatus,
      assigneeId: filterAssigneeId,
      priority: filterPriority,
      // Message filters
      channelId: filterChannelId,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    } = req.query as Record<string, string>;

    if (!q || q.trim().length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters.' });
      return;
    }

    const limit = Math.min(parseInt(limitStr) || 25, 50);
    const offset = parseInt(offsetStr) || 0;
    const searchTerm = q.trim();

    // 1. If workspaceId is provided, verify the user is a member
    if (workspaceId) {
      const [wsMember] = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.state, 'active')
          )
        )
        .limit(1);

      if (!wsMember) {
        res.status(403).json({ error: 'You do not have access to this workspace.' });
        return;
      }
    }

    // 2. Fetch accessible Project IDs for Tasks
    const projectConditions = [eq(projectMembers.userId, userId)];
    if (workspaceId) {
      projectConditions.push(eq(projects.workspaceId, workspaceId));
    }
    const projectRecords = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .leftJoin(projects, eq(projectMembers.projectId, projects.projectId))
      .where(and(...projectConditions));
    const projectIds = projectRecords.map(p => p.projectId).filter((id): id is string => id !== null);

    // 3. Fetch accessible Channel IDs for Messages
    const channelConditions = [eq(channelMembers.userId, userId)];
    if (workspaceId) {
      channelConditions.push(eq(channels.workspaceId, workspaceId));
    }
    const channelRecords = await db
      .select({ channelId: channelMembers.channelId })
      .from(channelMembers)
      .leftJoin(channels, eq(channelMembers.channelId, channels.channelId))
      .where(and(...channelConditions));
    const channelIds = channelRecords.map(c => c.channelId).filter((id): id is string => id !== null);

    let taskResults: any[] = [];
    let taskCount = 0;
    let messageResults: any[] = [];
    let messageCount = 0;

    // ── SEARCH TASKS ──────────────────────────────────────────────────────
    if ((type === 'all' || type === 'tasks') && projectIds.length > 0) {
      // Build dynamic conditions
      const taskConditions: any[] = [
        inArray(tasks.projectId, projectIds),
        isNull(tasks.deletedAt),
        or(
          sql`description_tsv @@ plainto_tsquery('english', ${searchTerm})`,
          ilike(tasks.title, `%${searchTerm}%`)
        )
      ];

      if (filterProjectId) {
        taskConditions.push(eq(tasks.projectId, filterProjectId));
      }
      if (filterStatus) {
        taskConditions.push(eq(tasks.status, filterStatus));
      }
      if (filterAssigneeId) {
        taskConditions.push(eq(tasks.assigneeId, filterAssigneeId));
      }
      if (filterPriority) {
        taskConditions.push(eq(tasks.priority, filterPriority));
      }

      // Count query
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(...taskConditions));
      taskCount = countRow?.count || 0;

      // Data query with JOINs
      const rawTasks = await db
        .select({
          taskId: tasks.taskId,
          taskKey: tasks.taskKey,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          issueType: tasks.issueType,
          createdAt: tasks.createdAt,
          descriptionText: tasks.descriptionText,
          // Project info
          projectName: projects.name,
          projectKey: projects.key,
          // Assignee info
          assigneeId: tasks.assigneeId,
          assigneeName: users.fullName,
          assigneeAvatar: users.avatarUrl,
          // Snippet via ts_headline
          snippet: sql<string>`CASE
            WHEN description_tsv @@ plainto_tsquery('english', ${searchTerm})
            THEN ts_headline('english', ${tasks.descriptionText}, plainto_tsquery('english', ${searchTerm}), 'MaxWords=25, MinWords=10, StartSel=<mark>, StopSel=</mark>')
            ELSE NULL
          END`,
          rank: sql<number>`(
            ts_rank(description_tsv, plainto_tsquery('english', ${searchTerm}))
            + (CASE WHEN ${tasks.title} ILIKE '%' || ${searchTerm} || '%' THEN 1 ELSE 0 END)
          )`
        })
        .from(tasks)
        .leftJoin(projects, eq(tasks.projectId, projects.projectId))
        .leftJoin(users, eq(tasks.assigneeId, users.userId))
        .where(and(...taskConditions))
        .orderBy(desc(sql`rank`), desc(tasks.createdAt))
        .limit(limit)
        .offset(offset);

      taskResults = rawTasks.map(t => ({
        type: 'task' as const,
        taskId: t.taskId,
        taskKey: t.taskKey,
        title: t.title,
        status: t.status,
        priority: t.priority,
        issueType: t.issueType,
        createdAt: t.createdAt,
        projectName: t.projectName,
        projectKey: t.projectKey,
        assigneeId: t.assigneeId,
        assigneeName: t.assigneeName,
        assigneeAvatar: t.assigneeAvatar,
        snippet: t.snippet || null,
        rank: Number(t.rank),
      }));
    }

    // ── SEARCH MESSAGES ───────────────────────────────────────────────────
    if ((type === 'all' || type === 'messages') && channelIds.length > 0) {
      const msgConditions: any[] = [
        inArray(messages.channelId, channelIds),
        eq(messages.isDeleted, false),
        or(
          sql`body_tsv @@ plainto_tsquery('english', ${searchTerm})`,
          ilike(messages.bodyText, `%${searchTerm}%`)
        )
      ];

      if (filterChannelId) {
        msgConditions.push(eq(messages.channelId, filterChannelId));
      }
      if (filterDateFrom) {
        msgConditions.push(gte(messages.createdAt, new Date(filterDateFrom)));
      }
      if (filterDateTo) {
        msgConditions.push(lte(messages.createdAt, new Date(filterDateTo)));
      }

      // Count query
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(...msgConditions));
      messageCount = countRow?.count || 0;

      // Data query with JOINs
      const rawMessages = await db
        .select({
          messageId: messages.messageId,
          channelId: messages.channelId,
          bodyText: messages.bodyText,
          createdAt: messages.createdAt,
          // Author info
          authorId: messages.authorId,
          authorName: users.fullName,
          authorAvatar: users.avatarUrl,
          // Channel info
          channelName: channels.name,
          // Highlighted snippet
          snippet: sql<string>`ts_headline('english', ${messages.bodyText}, plainto_tsquery('english', ${searchTerm}), 'MaxWords=25, MinWords=10, StartSel=<mark>, StopSel=</mark>')`,
          rank: sql<number>`(
            ts_rank(body_tsv, plainto_tsquery('english', ${searchTerm}))
            + (CASE WHEN ${messages.bodyText} ILIKE '%' || ${searchTerm} || '%' THEN 1 ELSE 0 END)
          )`
        })
        .from(messages)
        .leftJoin(channels, eq(messages.channelId, channels.channelId))
        .leftJoin(users, eq(messages.authorId, users.userId))
        .where(and(...msgConditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      messageResults = rawMessages.map(m => ({
        type: 'message' as const,
        messageId: m.messageId,
        channelId: m.channelId,
        bodyText: m.bodyText,
        createdAt: m.createdAt,
        authorId: m.authorId,
        authorName: m.authorName,
        authorAvatar: m.authorAvatar,
        channelName: m.channelName,
        snippet: m.snippet || m.bodyText?.substring(0, 150) || '',
        rank: Number(m.rank),
      }));
    }

    // 5. Return structured response
    res.json({
      tasks: taskResults,
      messages: messageResults,
      taskCount,
      messageCount,
      totalCount: taskCount + messageCount,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error processing search.' });
  }
};
