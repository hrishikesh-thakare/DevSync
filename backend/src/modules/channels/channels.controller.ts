import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { channels, channelMembers } from '../../db/schema/channels.js';
import { workspaceMembers } from '../../db/schema/workspaces.js';
import { projectMembers } from '../../db/schema/projects.js';
import { users } from '../../db/schema/auth.js';
import { eq, and } from 'drizzle-orm';
import { logAuditAction } from '../audit/audit.controller.js';

// ─── Helper: generate slug from channel name ────────────────────────────────
const channelSlug = (name: string): string =>
  name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

// ─── CREATE CHANNEL ──────────────────────────────────────────────────────────
// POST /api/workspaces/:workspaceId/channels
export const createChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId || res.locals.workspaceId;
    const userId = req.user!.userId;
    const { name, description, type, projectId, isAnnouncementOnly, isDefault, memberIds } = req.body;

    const channelName = name ? name.trim() : null;
    const channelType = type || 'public';
    const slug = channelName ? channelSlug(channelName) : '';

    const result = await db.transaction(async (tx) => {
      const [channel] = await tx
        .insert(channels)
        .values({
          workspaceId,
          projectId: projectId || null,
          name: channelName,
          slug,
          description: description || null,
          type: channelType,
          isDefault: isDefault || false,
          isAnnouncementOnly: isAnnouncementOnly || false,
          createdBy: userId,
        })
        .returning();

      // Add creator as first member
      const newMembers = [{ channelId: channel.channelId, userId }];
      
      if (Array.isArray(memberIds)) {
        for (const mId of memberIds) {
          if (mId !== userId) {
            newMembers.push({ channelId: channel.channelId, userId: mId });
          }
        }
      }

      await tx.insert(channelMembers).values(newMembers);

      await logAuditAction({
        actorId: userId,
        action: 'channel.created',
        entityType: 'channel',
        entityId: channel.channelId,
        workspaceId: workspaceId,
        newValues: { name: channel.name, slug: channel.slug, type: channel.type, project_id: channel.projectId, is_default: channel.isDefault },
        tx
      });

      return channel;
    });

    res.status(201).json({ message: 'Channel created', channel: result });
  } catch (err: any) {
    console.error('Create channel error:', err);
    const errStr = String(err?.message || err);
    if (err?.code === '23505' || errStr.includes('unique constraint') || errStr.includes('duplicate key')) {
      res.status(409).json({ error: 'Channel with this name already exists.' });
      return;
    }
    res.status(500).json({ error: 'Server error creating channel.' });
  }
};

// ─── LIST CHANNELS IN WORKSPACE ──────────────────────────────────────────────
// GET /api/workspaces/:workspaceId/channels
export const listChannels = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId || res.locals.workspaceId;
    const userId = req.user!.userId;
    const workspaceRole = req.workspaceRole; // from middleware

    const allChannels = await db
      .select()
      .from(channels)
      .where(and(eq(channels.workspaceId, workspaceId), eq(channels.isArchived, false)));

    // Fetch user's project memberships
    const userProjects = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    const userProjectIds = new Set(userProjects.map(p => p.projectId));

    // Fetch user's private channel memberships
    const userChannels = await db
      .select({ channelId: channelMembers.channelId })
      .from(channelMembers)
      .where(eq(channelMembers.userId, userId));
    const userChannelIds = new Set(userChannels.map(c => c.channelId));

    const visibleChannels = allChannels.filter(c => {
      if (c.projectId) {
        // Project-scoped channel
        if (workspaceRole === 'owner' || workspaceRole === 'admin') return true;
        return userProjectIds.has(c.projectId);
      } else {
        // Workspace-scoped channel
        if (c.type === 'public') return true;
        return userChannelIds.has(c.channelId);
      }
    });

    res.json({ channels: visibleChannels });
  } catch (err) {
    console.error('List channels error:', err);
    res.status(500).json({ error: 'Server error listing channels.' });
  }
};

// ─── GET SINGLE CHANNEL ─────────────────────────────────────────────────────
// GET /api/workspaces/:workspaceId/channels/:channelId
export const getChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;

    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.channelId, channelId))
      .limit(1);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }

    const members = await db
      .select({
        userId: channelMembers.userId,
        joinedAt: channelMembers.joinedAt,
        fullName: users.fullName,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
      })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.userId))
      .where(eq(channelMembers.channelId, channelId));

    res.json({ channel, members });
  } catch (err) {
    console.error('Get channel error:', err);
    res.status(500).json({ error: 'Server error fetching channel.' });
  }
};

// ─── JOIN CHANNEL ────────────────────────────────────────────────────────────
// POST /api/workspaces/:workspaceId/channels/:channelId/join
export const joinChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const userId = req.user!.userId;

    // Check if already a member
    const [existing] = await db
      .select({ id: channelMembers.id })
      .from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: 'Already a member of this channel.' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(channelMembers).values({ channelId, userId }).returning();

      const [channel] = await tx.select({ workspaceId: channels.workspaceId }).from(channels).where(eq(channels.channelId, channelId)).limit(1);

      await logAuditAction({
        actorId: userId,
        action: 'channel.member_added',
        entityType: 'channel',
        entityId: channelId,
        workspaceId: channel?.workspaceId ?? undefined,
        newValues: { user_id: userId },
        tx
      });
    });

    res.status(201).json({ message: 'Joined channel' });
  } catch (err: any) {
    console.error('Join channel error:', err);
    res.status(500).json({ error: 'Server error joining channel.' });
  }
};

// ─── LEAVE CHANNEL ───────────────────────────────────────────────────────────
// DELETE /api/workspaces/:workspaceId/channels/:channelId/leave
export const leaveChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const userId = req.user!.userId;

    const result = await db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(channelMembers)
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
        .returning({ id: channelMembers.id });

      if (removed) {
        const [channel] = await tx.select({ workspaceId: channels.workspaceId }).from(channels).where(eq(channels.channelId, channelId)).limit(1);
        await logAuditAction({
          actorId: userId,
          action: 'channel.member_removed',
          entityType: 'channel',
          entityId: channelId,
          workspaceId: channel?.workspaceId ?? undefined,
          newValues: null,
          oldValues: { user_id: userId },
          tx
        });
      }

      return removed;
    });

    if (!result) {
      res.status(404).json({ error: 'Not a member of this channel.' });
      return;
    }

    res.json({ message: 'Left channel' });
  } catch (err) {
    console.error('Leave channel error:', err);
    res.status(500).json({ error: 'Server error leaving channel.' });
  }
};

// ─── ARCHIVE CHANNEL ─────────────────────────────────────────────────────────
// PATCH /api/workspaces/:workspaceId/channels/:channelId/archive
export const archiveChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(channels)
        .set({ isArchived: true })
        .where(eq(channels.channelId, channelId))
        .returning();

      if (updated) {
        await logAuditAction({
          actorId: req.user!.userId,
          action: 'channel.archived',
          entityType: 'channel',
          entityId: channelId,
          workspaceId: updated.workspaceId ?? undefined,
          newValues: { is_archived: true },
          oldValues: { is_archived: false },
          tx
        });
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }

    res.json({ message: 'Channel archived', channel: result });
  } catch (err) {
    console.error('Archive channel error:', err);
    res.status(500).json({ error: 'Server error archiving channel.' });
  }
};

// ─── DELETE CHANNEL ──────────────────────────────────────────────────────────
// DELETE /api/workspaces/:workspaceId/channels/:channelId
export const deleteChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;

    const result = await db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(channels)
        .where(eq(channels.channelId, channelId))
        .returning();

      if (deleted) {
        await logAuditAction({
          actorId: req.user!.userId,
          action: 'channel.deleted',
          entityType: 'channel',
          entityId: channelId,
          workspaceId: deleted.workspaceId ?? undefined,
          newValues: null,
          oldValues: { name: deleted.name, type: deleted.type },
          tx
        });
      }

      return deleted;
    });

    if (!result) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }

    res.json({ message: 'Channel deleted successfully', channel: result });
  } catch (err) {
    console.error('Delete channel error:', err);
    res.status(500).json({ error: 'Server error deleting channel.' });
  }
};

// ─── UPDATE CHANNEL ──────────────────────────────────────────────────────────
// PATCH /api/workspaces/:workspaceId/channels/:channelId
export const updateChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const { name, description } = req.body;

    const updateData: any = {};
    if (name) {
      updateData.name = name.trim();
      updateData.slug = channelSlug(name);
    }
    if (description !== undefined) {
      updateData.description = description;
    }

    const result = await db.transaction(async (tx) => {
      const [oldChannel] = await tx.select().from(channels).where(eq(channels.channelId, channelId)).limit(1);

      const [updated] = await tx
        .update(channels)
        .set(updateData)
        .where(eq(channels.channelId, channelId))
        .returning();

      if (!updated || !oldChannel) return null;

      const actorId = req.user!.userId;
      const workspaceId = updated.workspaceId ?? undefined;
      const eType = 'channel';
      const eId = channelId;

      if (oldChannel.name !== updated.name) {
        await logAuditAction({ actorId, action: 'channel.name_changed', entityType: eType, entityId: eId, workspaceId, newValues: { name: updated.name }, oldValues: { name: oldChannel.name }, tx });
      }
      if (oldChannel.description !== updated.description) {
        await logAuditAction({ actorId, action: 'channel.description_changed', entityType: eType, entityId: eId, workspaceId, newValues: { description: updated.description }, oldValues: { description: oldChannel.description }, tx });
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }

    res.json({ message: 'Channel updated', channel: result });
  } catch (err) {
    console.error('Update channel error:', err);
    res.status(500).json({ error: 'Server error updating channel.' });
  }
};
