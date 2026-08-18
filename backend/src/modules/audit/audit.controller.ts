import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { auditLogs } from '../../db/schema/audit.js';
import { users } from '../../db/schema/auth.js';
import { workspaceMembers, workspaceInvites } from '../../db/schema/workspaces.js';
import { projects } from '../../db/schema/projects.js';
import { channels, messages } from '../../db/schema/channels.js';
import { tasks } from '../../db/schema/tasks.js';
import { sprints } from '../../db/schema/sprints.js';
import { projectLabels } from '../../db/schema/labels.js';
import { eq, and, desc } from 'drizzle-orm';

// ─── INTERNAL HELPER: Log an Action ──────────────────────────────────────────
export const logAuditAction = async (params: {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  workspaceId?: string;
  oldValues?: any;
  newValues?: any;
  tx?: any; // optional transaction object
}) => {
  try {
    const dbOrTx = params.tx || db;
    await dbOrTx.insert(auditLogs).values({
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      workspaceId: params.workspaceId || null,
      oldValues: params.oldValues || null,
      newValues: params.newValues || null,
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};

/**
 * Resolves the owning workspace of an entity directly from its own table.
 * Deterministic by design — access is never derived from the shape of the
 * audit log rows themselves. Returns null for unknown/unresolvable entities.
 */
const resolveEntityWorkspaceId = async (entityType: string, entityId: string): Promise<string | null> => {
  switch (entityType) {
    case 'workspace':
      return entityId;

    case 'project': {
      const [row] = await db
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(eq(projects.projectId, entityId))
        .limit(1);
      return row?.workspaceId ?? null;
    }

    case 'channel': {
      const [row] = await db
        .select({ workspaceId: channels.workspaceId })
        .from(channels)
        .where(eq(channels.channelId, entityId))
        .limit(1);
      return row?.workspaceId ?? null;
    }

    case 'task': {
      const [row] = await db
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.taskId, entityId))
        .limit(1);
      if (!row?.projectId) return null;
      const [proj] = await db
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(eq(projects.projectId, row.projectId))
        .limit(1);
      return proj?.workspaceId ?? null;
    }

    case 'sprint': {
      const [row] = await db
        .select({ projectId: sprints.projectId })
        .from(sprints)
        .where(eq(sprints.sprintId, entityId))
        .limit(1);
      if (!row?.projectId) return null;
      const [proj] = await db
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(eq(projects.projectId, row.projectId))
        .limit(1);
      return proj?.workspaceId ?? null;
    }

    case 'project_label': {
      const [row] = await db
        .select({ projectId: projectLabels.projectId })
        .from(projectLabels)
        .where(eq(projectLabels.labelId, entityId))
        .limit(1);
      if (!row?.projectId) return null;
      const [proj] = await db
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(eq(projects.projectId, row.projectId))
        .limit(1);
      return proj?.workspaceId ?? null;
    }

    case 'message': {
      const [row] = await db
        .select({ channelId: messages.channelId })
        .from(messages)
        .where(eq(messages.messageId, entityId))
        .limit(1);
      if (!row?.channelId) return null;
      const [ch] = await db
        .select({ workspaceId: channels.workspaceId })
        .from(channels)
        .where(eq(channels.channelId, row.channelId))
        .limit(1);
      return ch?.workspaceId ?? null;
    }

    case 'workspace_member': {
      const [row] = await db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.id, entityId))
        .limit(1);
      return row?.workspaceId ?? null;
    }

    case 'workspace_invite': {
      const [row] = await db
        .select({ workspaceId: workspaceInvites.workspaceId })
        .from(workspaceInvites)
        .where(eq(workspaceInvites.inviteId, entityId))
        .limit(1);
      return row?.workspaceId ?? null;
    }

    default:
      return null;
  }
};

// ─── GET AUDIT LOGS BY ENTITY ────────────────────────────────────────────────
// GET /api/audit/:entityType/:entityId
export const getEntityAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityType, entityId } = req.params as Record<string, string>;
    const { limit = 50 } = req.query;
    const userId = req.user!.userId;

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);

    // ── Path 1: User logs are PII — ownership only ──
    // Login/logout/registration events are global (no workspace), so they are
    // visible exclusively to the user who generated them. Workspace-scoped
    // activity is audited via /api/audit/workspace/:workspaceId instead.
    if (entityType === 'user') {
      if (userId !== entityId) {
        res.status(403).json({ error: 'Forbidden. You can only view your own audit logs.' });
        return;
      }
    } else {
      // ── Path 2: Workspace-scoped entities — resolve workspace deterministically ──
      const workspaceIdToCheck = await resolveEntityWorkspaceId(entityType, entityId);

      if (!workspaceIdToCheck) {
        res.status(403).json({ error: 'Forbidden. Cannot resolve access for this audit entity.' });
        return;
      }

      const [membership] = await db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceIdToCheck),
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.state, 'active')
          )
        )
        .limit(1);

      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        res.status(403).json({ error: 'Forbidden. Only workspace owners and admins can view audit logs.' });
        return;
      }
    }

    const logs = await db
      .select({
        logId: auditLogs.logId,
        action: auditLogs.action,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        createdAt: auditLogs.createdAt,
        actorId: users.userId,
        actorName: users.fullName,
        actorAvatar: users.avatarUrl,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.userId))
      .where(
        entityType === 'workspace' 
          ? eq(auditLogs.workspaceId, entityId)
          : and(
              eq(auditLogs.entityType, entityType),
              eq(auditLogs.entityId, entityId)
            )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(parsedLimit);

    res.json({ logs });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Server error fetching audit logs.' });
  }
};
