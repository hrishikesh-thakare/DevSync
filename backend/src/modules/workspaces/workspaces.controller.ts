import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { workspaces, workspaceMembers, workspaceInvites } from '../../db/schema/workspaces.js';
import { users } from '../../db/schema/auth.js';
import { eq, and, isNull } from 'drizzle-orm';
import { logAuditAction } from '../audit/audit.controller.js';
import { createNotification } from '../notifications/notifications.controller.js';
import { sendInviteEmail } from '../../services/email.service.js';
import crypto from 'crypto';

// ─── Helper: generate a URL-safe slug from a workspace name ──────────────────
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
};

// ─── CREATE WORKSPACE ────────────────────────────────────────────────────────
// POST /api/workspaces
export const createWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, iconUrl } = req.body;
    const userId = req.user!.userId;

    const slug = generateSlug(name);

    const result = await db.transaction(async (tx) => {
      // 1. Create the workspace
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name: name.trim(),
          slug,
          description: description || null,
          iconUrl: iconUrl || null,
          ownerId: userId,
        })
        .returning();

      // 2. Add creator as owner in workspace_members
      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.workspaceId,
        userId,
        role: 'owner',
        state: 'active',
      });

      await logAuditAction({
        actorId: userId,
        action: 'workspace.created',
        entityType: 'workspace',
        entityId: workspace.workspaceId,
        workspaceId: workspace.workspaceId,
        newValues: { name: workspace.name, slug: workspace.slug, owner_id: workspace.ownerId },
        tx
      });

      return workspace;
    });

    res.status(201).json({
      message: 'Workspace created successfully',
      workspace: result,
    });
  } catch (err: any) {
    console.error('Create workspace error:', err);
    const errStr = String(err?.message || err);
    if (err?.code === '23505' || errStr.includes('unique constraint') || errStr.includes('duplicate key')) {
      res.status(409).json({ error: 'Workspace with this slug already exists.' });
      return;
    }
    res.status(500).json({ error: 'Server error creating workspace.' });
  }
};

// ─── LIST MY WORKSPACES ──────────────────────────────────────────────────────
// GET /api/workspaces
export const listWorkspaces = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Get all workspaces where this user is an active member
    const results = await db
      .select({
        workspaceId: workspaces.workspaceId,
        name: workspaces.name,
        slug: workspaces.slug,
        iconUrl: workspaces.iconUrl,
        description: workspaces.description,
        ownerId: workspaces.ownerId,
        createdAt: workspaces.createdAt,
        role: workspaceMembers.role,
        state: workspaceMembers.state,
        joinedAt: workspaceMembers.joinedAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          isNull(workspaces.deletedAt)
        )
      );

    res.json({ workspaces: results });
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({ error: 'Server error listing workspaces.' });
  }
};

// ─── GET SINGLE WORKSPACE ───────────────────────────────────────────────────
// GET /api/workspaces/:workspaceId
export const getWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId || res.locals.workspaceId;

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.workspaceId, workspaceId), isNull(workspaces.deletedAt)))
      .limit(1);

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }

    // Get member count
    const members = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        state: workspaceMembers.state,
        joinedAt: workspaceMembers.joinedAt,
        fullName: users.fullName,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    res.json({ workspace, members });
  } catch (err) {
    console.error('Get workspace error:', err);
    res.status(500).json({ error: 'Server error fetching workspace.' });
  }
};

// ─── LIST WORKSPACE MEMBERS ─────────────────────────────────────────────────
// GET /api/workspaces/:slug/members
export const listWorkspaceMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId || res.locals.workspaceId;

    const members = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        state: workspaceMembers.state,
        joinedAt: workspaceMembers.joinedAt,
        fullName: users.fullName,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    res.json({ members });
  } catch (err) {
    console.error('List workspace members error:', err);
    res.status(500).json({ error: 'Server error listing workspace members.' });
  }
};

// ─── UPDATE WORKSPACE ────────────────────────────────────────────────────────
// PATCH /api/workspaces/:workspaceId
export const updateWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { name, description, iconUrl } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) {
      updateData.name = name.trim();
      updateData.slug = generateSlug(name);
    }
    if (description !== undefined) updateData.description = description;
    if (iconUrl !== undefined) updateData.iconUrl = iconUrl;

    const result = await db.transaction(async (tx) => {
      const [oldWorkspace] = await tx.select().from(workspaces).where(eq(workspaces.workspaceId, workspaceId)).limit(1);

      const [updated] = await tx
        .update(workspaces)
        .set(updateData)
        .where(and(eq(workspaces.workspaceId, workspaceId), isNull(workspaces.deletedAt)))
        .returning();

      if (!updated || !oldWorkspace) return null;

      const actorId = req.user!.userId;
      const eType = 'workspace';
      const eId = workspaceId;

      if (oldWorkspace.name !== updated.name) {
        await logAuditAction({ actorId, action: 'workspace.name_changed', entityType: eType, entityId: eId, workspaceId, newValues: { name: updated.name }, oldValues: { name: oldWorkspace.name }, tx });
      }
      if (oldWorkspace.slug !== updated.slug) {
        await logAuditAction({ actorId, action: 'workspace.slug_changed', entityType: eType, entityId: eId, workspaceId, newValues: { slug: updated.slug }, oldValues: { slug: oldWorkspace.slug }, tx });
      }
      if (oldWorkspace.description !== updated.description) {
        await logAuditAction({ actorId, action: 'workspace.description_changed', entityType: eType, entityId: eId, workspaceId, newValues: { description: updated.description }, oldValues: { description: oldWorkspace.description }, tx });
      }
      if (oldWorkspace.iconUrl !== updated.iconUrl) {
        await logAuditAction({ actorId, action: 'workspace.icon_changed', entityType: eType, entityId: eId, workspaceId, newValues: { icon_url: updated.iconUrl }, oldValues: { icon_url: oldWorkspace.iconUrl }, tx });
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }

    res.json({ message: 'Workspace updated', workspace: result });
  } catch (err) {
    console.error('Update workspace error:', err);
    res.status(500).json({ error: 'Server error updating workspace.' });
  }
};

// ─── SOFT DELETE WORKSPACE ───────────────────────────────────────────────────
// DELETE /api/workspaces/:workspaceId
export const deleteWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId || res.locals.workspaceId;

    const result = await db.transaction(async (tx) => {
      const [oldWorkspace] = await tx.select().from(workspaces).where(and(eq(workspaces.workspaceId, workspaceId), isNull(workspaces.deletedAt))).limit(1);
      if (!oldWorkspace) return null;

      const [deleted] = await tx
        .update(workspaces)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(workspaces.workspaceId, workspaceId))
        .returning({ workspaceId: workspaces.workspaceId });

      await logAuditAction({
        actorId: req.user!.userId,
        action: 'workspace.deleted',
        entityType: 'workspace',
        entityId: workspaceId,
        workspaceId,
        newValues: null,
        oldValues: { name: oldWorkspace.name, slug: oldWorkspace.slug },
        tx
      });

      return deleted;
    });

    if (!result) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }

    res.json({ message: 'Workspace deleted successfully' });
  } catch (err) {
    console.error('Delete workspace error:', err);
    res.status(500).json({ error: 'Server error deleting workspace.' });
  }
};

// ─── INVITE MEMBER ───────────────────────────────────────────────────────────
// POST /api/workspaces/:workspaceId/invite
export const inviteMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const inviterId = req.user!.userId;
    const { email, role } = req.body;

    const memberRole = role || 'member';

    // Find the user by email
    const [targetUser] = await db
      .select({ userId: users.userId, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    const [actor] = await db.select({ name: users.fullName }).from(users).where(eq(users.userId, inviterId));
    const [workspace] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.workspaceId, workspaceId));

    if (!targetUser) {
      // User doesn't exist. Create a pending invite and send email.
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Invite valid for 7 days

      await db.transaction(async (tx) => {
        // Delete any existing invite for this email in this workspace
        await tx.delete(workspaceInvites).where(and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.email, email.toLowerCase().trim())));
        
        await tx.insert(workspaceInvites).values({
          workspaceId,
          email: email.toLowerCase().trim(),
          role: memberRole,
          token,
          invitedBy: inviterId,
          expiresAt,
        });

        await logAuditAction({
          actorId: inviterId, action: 'workspace_invite.created', entityType: 'workspace_invite', entityId: email.toLowerCase().trim(), workspaceId,
          newValues: { email: email.toLowerCase().trim(), role: memberRole, invited_by: inviterId }, tx
        });
      });

      // Send the email
      await sendInviteEmail(email.toLowerCase().trim(), workspace?.name || 'Workspace', token, actor?.name || 'Someone');

      res.status(201).json({ message: 'Invitation email sent successfully.' });
      return;
    }

    // Check if already a member
    const [existing] = await db
      .select({ id: workspaceMembers.id, state: workspaceMembers.state })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUser.userId)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.state === 'active') {
        res.status(409).json({ error: 'User is already an active member of this workspace.' });
        return;
      }
      // Re-activate a previously deactivated member
      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(workspaceMembers)
          .set({ state: 'active', role: memberRole, joinedAt: new Date() })
          .where(eq(workspaceMembers.id, existing.id))
          .returning();

        await logAuditAction({
          actorId: inviterId, action: 'workspace_member.reactivated', entityType: 'workspace_member', entityId: existing.id, workspaceId,
          newValues: { state: 'active' }, oldValues: { state: 'deactivated' }, tx
        });
        return updated;
      });

      res.json({ message: 'Member re-activated', user: targetUser });
      return;
    }

    // Create membership
    await db.transaction(async (tx) => {
      const [member] = await tx.insert(workspaceMembers).values({
        workspaceId,
        userId: targetUser.userId,
        role: memberRole,
        invitedBy: inviterId,
        state: 'invited', // Changed from active to invited
      }).returning();

      await logAuditAction({
        actorId: inviterId, action: 'workspace_member.invited', entityType: 'workspace_member', entityId: member.id, workspaceId,
        newValues: { user_id: targetUser.userId, email: targetUser.email, role: memberRole, invited_by: inviterId }, tx
      });
    });

    await createNotification({
      recipientId: targetUser.userId,
      actorId: inviterId,
      type: 'workspace_invited',
      entityType: 'workspace',
      entityId: workspaceId,
      title: `You were invited to ${workspace?.name || 'Workspace'}`,
      body: `${actor?.name || 'Someone'} invited you to join ${workspace?.name || 'Workspace'} as ${memberRole.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
    });

    res.status(201).json({ message: 'Member invited successfully', user: targetUser });
  } catch (err) {
    console.error('Invite member error:', err);
    res.status(500).json({ error: 'Server error inviting member.' });
  }
};

// ─── ACCEPT INVITE ───────────────────────────────────────────────────────────
// POST /api/workspaces/:workspaceId/invites/accept
export const acceptInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId || res.locals.workspaceId;
    const currentUserId = req.user!.userId;

    const [updated] = await db
      .update(workspaceMembers)
      .set({ state: 'active', joinedAt: new Date() })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, currentUserId),
          eq(workspaceMembers.state, 'invited')
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Pending invite not found.' });
      return;
    }

    await logAuditAction({
      actorId: currentUserId,
      action: 'workspace_member.invite_accepted',
      entityType: 'workspace_member',
      entityId: updated.id,
      workspaceId: workspaceId,
      oldValues: { state: 'invited' },
      newValues: { state: 'active' }
    });

    res.json({ message: 'Invite accepted', member: updated });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: 'Server error accepting invite.' });
  }
};

// ─── UPDATE MEMBER ROLE ──────────────────────────────────────────────────────
// PATCH /api/workspaces/:workspaceId/members/:userId
export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const actorId = req.user!.userId;
    const workspaceId = req.params.workspaceId as string;

    const targetUserId = req.params.userId as string;

    if (actorId === targetUserId) {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [oldMember] = await tx.select().from(workspaceMembers).where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
        eq(workspaceMembers.state, 'active')
      )).limit(1);

      if (!oldMember) return null;

      const [updated] = await tx
        .update(workspaceMembers)
        .set({ role })
        .where(eq(workspaceMembers.id, oldMember.id))
        .returning();

      await logAuditAction({
        actorId, action: 'workspace_member.role_changed', entityType: 'workspace_member', entityId: updated.id, workspaceId,
        newValues: { role: updated.role, user_id: updated.userId }, oldValues: { role: oldMember.role, user_id: oldMember.userId }, tx
      });

      // If promoting to owner, transfer ownership
      if (role === 'owner') {
        await tx
          .update(workspaces)
          .set({ ownerId: targetUserId, updatedAt: new Date() })
          .where(eq(workspaces.workspaceId, workspaceId));

        // Demote current owner to admin
        const [demoted] = await tx
          .update(workspaceMembers)
          .set({ role: 'admin' })
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, actorId)
            )
          ).returning();

        if (demoted) {
          await logAuditAction({
            actorId, action: 'workspace_member.role_changed', entityType: 'workspace_member', entityId: demoted.id, workspaceId,
            newValues: { role: demoted.role, user_id: demoted.userId }, oldValues: { role: 'owner', user_id: demoted.userId }, tx
          });
        }
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Member not found in this workspace.' });
      return;
    }

    res.json({ message: 'Member role updated', member: result });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ error: 'Server error updating member role.' });
  }
};

// ─── REMOVE MEMBER ───────────────────────────────────────────────────────────
// DELETE /api/workspaces/:workspaceId/members/:userId
export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as Record<string, string>;
    const workspaceId = req.params.workspaceId || res.locals.workspaceId;
    const currentUserId = req.user!.userId;

    // Check if trying to remove the owner
    const [workspace] = await db
      .select({ ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.workspaceId, workspaceId))
      .limit(1);

    if (workspace && workspace.ownerId === userId && userId !== currentUserId) {
      res.status(403).json({ error: 'Cannot remove the workspace owner.' });
      return;
    }

    // Allow self-leave (user removing themselves)
    // For others, the role middleware already ensures admin/owner access

    const result = await db.transaction(async (tx) => {
      const [oldMember] = await tx.select().from(workspaceMembers).where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.state, 'active')
      )).limit(1);

      if (!oldMember) return null;

      const [removed] = await tx
        .update(workspaceMembers)
        .set({ state: 'deactivated' })
        .where(eq(workspaceMembers.id, oldMember.id))
        .returning({ id: workspaceMembers.id, userId: workspaceMembers.userId, role: workspaceMembers.role });

      await logAuditAction({
        actorId: currentUserId,
        action: 'workspace_member.deactivated',
        entityType: 'workspace_member',
        entityId: removed.id,
        workspaceId,
        newValues: { state: 'deactivated' },
        oldValues: { state: 'active' },
        tx
      });

      return removed;
    });

    if (!result) {
      res.status(404).json({ error: 'Member not found in this workspace.' });
      return;
    }

    res.json({ message: userId === currentUserId ? 'You have left the workspace' : 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Server error removing member.' });
  }
};
