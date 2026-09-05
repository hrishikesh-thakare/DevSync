import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { projects, projectMembers } from '../../db/schema/projects.js';
import { workspaceMembers } from '../../db/schema/workspaces.js';
import { users } from '../../db/schema/auth.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getIO } from '../../sockets/index.js';
import { logAuditAction } from '../audit/audit.controller.js';
import { createNotification } from '../notifications/notifications.controller.js';

// ─── CREATE PROJECT ──────────────────────────────────────────────────────────
// POST /api/workspaces/:workspaceId/projects
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const { name, key, description, iconUrl } = req.body;
    const userId = req.user!.userId;

    const projectKey = key; // Zod handles upper case and constraints

    // Check for duplicate key in this workspace — only among live projects,
    // same reasoning as the `register` email check: without the `deletedAt`
    // filter a deleted project's key would be unusable forever.
    const [existing] = await db
      .select({ projectId: projects.projectId })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, projectKey), isNull(projects.deletedAt)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: `Project key "${projectKey}" already exists in this workspace.` });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // 1. Create project
      const [project] = await tx
        .insert(projects)
        .values({
          workspaceId,
          name: name.trim(),
          key: projectKey,
          description: description || null,
          iconUrl: iconUrl || null,
          leadUserId: userId,
        })
        .returning();

      // 2. Add creator as project_admin
      await tx.insert(projectMembers).values({
        projectId: project.projectId,
        userId,
        role: 'project_admin',
        addedBy: userId,
      });

      await logAuditAction({
        actorId: userId,
        action: 'project.created',
        entityType: 'project',
        entityId: project.projectId,
        workspaceId: workspaceId,
        newValues: { name: project.name, key: project.key, lead_user_id: project.leadUserId, workspace_id: project.workspaceId },
        tx
      });

      return project;
    });

    res.status(201).json({ message: 'Project created', project: result });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Server error creating project.' });
  }
};

// ─── LIST PROJECTS IN WORKSPACE ──────────────────────────────────────────────
// GET /api/workspaces/:workspaceId/projects
export const listProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const workspaceRole = req.workspaceRole; // attached by requireWorkspaceRole

    let query = db
      .select({
        projectId: projects.projectId,
        name: projects.name,
        key: projects.key,
        description: projects.description,
        iconUrl: projects.iconUrl,
        status: projects.status,
        issueCounter: projects.issueCounter,
        createdAt: projects.createdAt,
        leadName: users.fullName,
        leadAvatar: users.avatarUrl,
      })
      .from(projects)
      .leftJoin(users, eq(projects.leadUserId, users.userId))
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, 'active'), isNull(projects.deletedAt)));

    // If the user is just a regular workspace member, they can only see projects they are explicitly added to.
    if (workspaceRole === 'member') {
      // Create a subquery or join to filter
      const results = await db
        .select({
          projectId: projects.projectId,
          name: projects.name,
          key: projects.key,
          description: projects.description,
          iconUrl: projects.iconUrl,
          status: projects.status,
          issueCounter: projects.issueCounter,
          createdAt: projects.createdAt,
          leadName: users.fullName,
          leadAvatar: users.avatarUrl,
        })
        .from(projects)
        .leftJoin(users, eq(projects.leadUserId, users.userId))
        .innerJoin(projectMembers, and(eq(projects.projectId, projectMembers.projectId), eq(projectMembers.userId, userId)))
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, 'active'), isNull(projects.deletedAt)));

      res.json({ projects: results });
      return;
    }

    const results = await query;
    res.json({ projects: results });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Server error listing projects.' });
  }
};

// ─── GET SINGLE PROJECT ──────────────────────────────────────────────────────
// GET /api/workspaces/:workspaceId/projects/:projectId
export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;

    // Explicitly projected, never `select()`. An unprojected select here shipped
    // `github_webhook_secret` — the encrypted HMAC secret used to verify inbound
    // GitHub webhooks — to every project member on the wire. Nothing rendered
    // it, so it was invisible, but it had no business leaving the server.
    const [project] = await db
      .select({
        projectId: projects.projectId,
        workspaceId: projects.workspaceId,
        name: projects.name,
        key: projects.key,
        description: projects.description,
        iconUrl: projects.iconUrl,
        leadUserId: projects.leadUserId,
        githubRepoOwner: projects.githubRepoOwner,
        githubRepoName: projects.githubRepoName,
        issueCounter: projects.issueCounter,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    // Get members
    const members = await db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        addedAt: projectMembers.addedAt,
        fullName: users.fullName,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.userId))
      .where(eq(projectMembers.projectId, projectId));

    res.json({ project, members });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Server error fetching project.' });
  }
};

// ─── UPDATE PROJECT ──────────────────────────────────────────────────────────
// PATCH /api/workspaces/:workspaceId/projects/:projectId
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const { name, description, iconUrl, status } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (iconUrl !== undefined) updateData.iconUrl = iconUrl;
    if (status !== undefined) {
      updateData.status = status;
    }

    const result = await db.transaction(async (tx) => {
      const [oldProject] = await tx.select().from(projects).where(eq(projects.projectId, projectId)).limit(1);

      const [updated] = await tx
        .update(projects)
        .set(updateData)
        .where(eq(projects.projectId, projectId))
        .returning();

      if (!updated || !oldProject) return null;

      const actorId = req.user!.userId;
      const workspaceId = updated.workspaceId ?? undefined;
      const eType = 'project';
      const eId = projectId;

      if (oldProject.name !== updated.name) {
        await logAuditAction({ actorId, action: 'project.name_changed', entityType: eType, entityId: eId, workspaceId, newValues: { name: updated.name }, oldValues: { name: oldProject.name }, tx });
      }
      if (oldProject.description !== updated.description) {
        await logAuditAction({ actorId, action: 'project.description_changed', entityType: eType, entityId: eId, workspaceId, newValues: { description: updated.description }, oldValues: { description: oldProject.description }, tx });
      }
      if (oldProject.iconUrl !== updated.iconUrl) {
        await logAuditAction({ actorId, action: 'project.icon_changed', entityType: eType, entityId: eId, workspaceId, newValues: { icon_url: updated.iconUrl }, oldValues: { icon_url: oldProject.iconUrl }, tx });
      }
      if (oldProject.leadUserId !== updated.leadUserId) {
        await logAuditAction({ actorId, action: 'project.lead_changed', entityType: eType, entityId: eId, workspaceId, newValues: { lead_user_id: updated.leadUserId }, oldValues: { lead_user_id: oldProject.leadUserId }, tx });
      }

      if (oldProject.status !== updated.status) {
        if (updated.status === 'archived') {
          await logAuditAction({ actorId, action: 'project.archived', entityType: eType, entityId: eId, workspaceId, newValues: { status: 'archived' }, oldValues: { status: 'active' }, tx });
        } else {
          await logAuditAction({ actorId, action: 'project.unarchived', entityType: eType, entityId: eId, workspaceId, newValues: { status: 'active' }, oldValues: { status: 'archived' }, tx });
        }
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    res.json({ message: 'Project updated', project: result });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Server error updating project.' });
  }
};

// ─── ADD PROJECT MEMBER ──────────────────────────────────────────────────────
// POST /api/workspaces/:workspaceId/projects/:projectId/members
export const addProjectMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId, projectId } = req.params as Record<string, string>;
    const { userId: targetUserId, role } = req.body;
    const addedBy = req.user!.userId;

    const memberRole = role || 'developer';

    // Verify the target user is a member of the workspace
    const [wsMember] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
          eq(workspaceMembers.state, 'active')
        )
      )
      .limit(1);

    if (!wsMember) {
      res.status(400).json({ error: 'User must be a workspace member before being added to a project.' });
      return;
    }

    // Check if already a project member
    const [existing] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: 'User is already a member of this project.' });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [member] = await tx
        .insert(projectMembers)
        .values({
          projectId,
          userId: targetUserId,
          role: memberRole,
          addedBy,
        })
        .returning();

      await logAuditAction({
        actorId: addedBy,
        action: 'project_member.added',
        entityType: 'project',
        entityId: projectId,
        workspaceId,
        newValues: { user_id: targetUserId, role: memberRole },
        tx
      });

      return member;
    });

    const actorId = req.user!.userId;
    if (targetUserId !== actorId) {
      const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, actorId));
      const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.projectId, projectId));
      await createNotification({
        recipientId: targetUserId,
        actorId,
        type: 'project_member_added',
        entityType: 'project',
        entityId: projectId,
        title: `You were added to ${project?.name || 'Project'}`,
        body: `${actor?.name || 'Someone'} added you to ${project?.name || 'Project'} as ${memberRole.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
      });
    }

    res.status(201).json({ message: 'Member added to project', member: result });
  } catch (err) {
    console.error('Add project member error:', err);
    res.status(500).json({ error: 'Server error adding project member.' });
  }
};

// ─── REMOVE PROJECT MEMBER ──────────────────────────────────────────────────
// DELETE /api/workspaces/:workspaceId/projects/:projectId/members/:userId
export const removeProjectMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, userId } = req.params as Record<string, string>;

    // If the user being removed is an admin, check if they are the last one
    const [targetMember] = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

    if (!targetMember) {
      res.status(404).json({ error: 'Member not found in this project.' });
      return;
    }

    if (targetMember.role === 'project_admin') {
      const [{ count }] = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'project_admin')));
      
      if (count <= 1) {
        res.status(400).json({ error: 'Cannot remove the last project admin.' });
        return;
      }
    }

    const result = await db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
        .returning({ id: projectMembers.id });

      if (removed) {
        // Find workspaceId
        const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, projectId)).limit(1);

        await logAuditAction({
          actorId: req.user!.userId,
          action: 'project_member.removed',
          entityType: 'project',
          entityId: projectId,
          workspaceId: project?.workspaceId ?? undefined,
          newValues: null,
          oldValues: { user_id: userId, role: targetMember.role },
          tx
        });
      }

      return removed;
    });

    if (!result) {
      res.status(404).json({ error: 'Member not found in this project.' });
      return;
    }

    res.json({ message: 'Member removed from project' });
  } catch (err) {
    console.error('Remove project member error:', err);
    res.status(500).json({ error: 'Server error removing project member.' });
  }
};

// ─── LIST PROJECT MEMBERS ─────────────────────────────────────────────────
// GET /api/workspaces/:slug/projects/:key/members
export const listProjectMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;

    const members = await db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        addedAt: projectMembers.addedAt,
        fullName: users.fullName,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.userId))
      .where(eq(projectMembers.projectId, projectId));

    res.json({ members });
  } catch (err) {
    console.error('List project members error:', err);
    res.status(500).json({ error: 'Server error listing project members.' });
  }
};

// ─── UPDATE PROJECT MEMBER ROLE ───────────────────────────────────────────
// PUT /api/workspaces/:slug/projects/:key/members/:userId
export const updateProjectMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, userId } = req.params as Record<string, string>;
    const { role } = req.body;

    // Check if trying to demote the last project admin
    if (role !== 'project_admin') {
      const [targetMember] = await db
        .select({ role: projectMembers.role })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

      if (!targetMember) {
        res.status(404).json({ error: 'Member not found in this project.' });
        return;
      }

      if (targetMember.role === 'project_admin') {
        const [{ count }] = await db
          .select({ count: sql<number>`cast(count(*) as integer)` })
          .from(projectMembers)
          .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'project_admin')));
        
        if (count <= 1) {
          res.status(400).json({ error: 'Cannot demote the last project admin.' });
          return;
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      const [oldMember] = await tx.select({ role: projectMembers.role }).from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).limit(1);

      const [updated] = await tx
        .update(projectMembers)
        .set({ role })
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
        .returning();

      if (updated) {
        // Find workspaceId
        const [project] = await tx.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, projectId)).limit(1);

        await logAuditAction({
          actorId: req.user!.userId,
          action: 'project_member.role_changed',
          entityType: 'project',
          entityId: projectId,
          workspaceId: project?.workspaceId ?? undefined,
          newValues: { role: updated.role, user_id: updated.userId },
          oldValues: { role: oldMember?.role ?? null, user_id: userId },
          tx
        });
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Member not found in this project.' });
      return;
    }

    res.json({ message: 'Project member role updated', member: result });
  } catch (err) {
    console.error('Update project member role error:', err);
    res.status(500).json({ error: 'Server error updating project member role.' });
  }
};

// ─── ARCHIVE PROJECT ─────────────────────────────────────────────────────
// PATCH /api/workspaces/:slug/projects/:key/archive
export const archiveProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(projects)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(projects.projectId, projectId))
        .returning();

      if (updated) {
        await logAuditAction({
          actorId: req.user!.userId,
          action: 'project.archived',
          entityType: 'project',
          entityId: projectId,
          workspaceId: updated.workspaceId ?? undefined,
          newValues: { status: 'archived' },
          oldValues: { status: 'active' },
          tx
        });
      }
      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    res.json({ message: 'Project archived', project: result });
  } catch (err) {
    console.error('Archive project error:', err);
    res.status(500).json({ error: 'Server error archiving project.' });
  }
};

// ─── DELETE PROJECT ──────────────────────────────────────────────────────────
// DELETE /api/workspaces/:workspaceId/projects/:key
//
// Soft-delete, same shape as `deleteWorkspace`: stamp `deletedAt` rather than
// removing the row. Tasks, sprints, channels and labels that point at this
// project are left exactly where they are — they simply become unreachable,
// because `resolveProjectKey` (every `:key`-scoped route) and `listProjects`
// both filter on `deletedAt IS NULL` now. That mirrors how a soft-deleted
// workspace already leaves its projects in place without this module having
// to know about it; nothing here has to cascade a delete through five child
// tables to get the same effect.
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ workspaceId: projects.workspaceId, name: projects.name, key: projects.key })
        .from(projects)
        .where(and(eq(projects.projectId, projectId), isNull(projects.deletedAt)))
        .limit(1);

      if (!existing) return null;

      await tx
        .update(projects)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(projects.projectId, projectId));

      await logAuditAction({
        actorId: req.user!.userId,
        action: 'project.deleted',
        entityType: 'project',
        entityId: projectId,
        workspaceId: existing.workspaceId ?? undefined,
        newValues: null,
        oldValues: { name: existing.name, key: existing.key },
        tx,
      });

      return existing;
    });

    if (!result) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Server error deleting project.' });
  }
};
