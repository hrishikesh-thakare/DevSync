import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db.js';
import { channels, channelMembers } from '../db/schema/channels.js';
import { projectMembers } from '../db/schema/projects.js';
import { workspaceMembers } from '../db/schema/workspaces.js';
import { eq, and } from 'drizzle-orm';

/**
 * Middleware to restrict access based on Channel membership.
 * Requires requireAuth to run first to populate req.user.
 *
 * Mirrors the access logic enforced on socket room subscriptions
 * (see canAccessChannel in sockets/index.ts).
 */
export const requireChannelAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const channelId = req.params?.channelId || req.body?.channelId || req.query?.channelId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized. Auth context missing.' });
      return;
    }

    if (!channelId || typeof channelId !== 'string') {
      res.status(400).json({ error: 'channelId is required for this action.' });
      return;
    }

    // 1. Fetch channel details
    const [channel] = await db
      .select({
        workspaceId: channels.workspaceId,
        projectId: channels.projectId,
        type: channels.type,
      })
      .from(channels)
      .where(eq(channels.channelId, channelId))
      .limit(1);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }

    if (!channel.workspaceId) {
      res.status(403).json({ error: 'Forbidden. Channel has no workspace.' });
      return;
    }

    // 2. Every channel requires active membership in its workspace
    const [membership] = await db
      .select({ role: workspaceMembers.role, state: workspaceMembers.state })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, channel.workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership || membership.state !== 'active') {
      res.status(403).json({ error: 'Forbidden. You are not a member of this workspace.' });
      return;
    }

    // 3. Workspace owners/admins get implicit access to all channels
    if (membership.role === 'owner' || membership.role === 'admin') {
      return next();
    }

    if (channel.projectId) {
      // --- Project-Scoped Channel ---
      // Regular users must be members of the project
      const [pMember] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, channel.projectId),
            eq(projectMembers.userId, userId)
          )
        )
        .limit(1);

      if (!pMember) {
        res.status(403).json({ error: 'Forbidden. You do not have access to this project channel.' });
        return;
      }

      return next();

    } else {
      // --- Workspace-Scoped Channel ---

      // Public workspace channels are accessible to all active workspace members
      if (channel.type === 'public') {
        return next();
      }

      // Private channels and DMs require explicit channel membership
      const [cMember] = await db
        .select({ id: channelMembers.id })
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, userId)
          )
        )
        .limit(1);

      if (!cMember) {
        res.status(403).json({ error: 'Forbidden. You are not a member of this private channel.' });
        return;
      }

      return next();
    }
  } catch (err) {
    console.error('requireChannelAccess error:', err);
    res.status(500).json({ error: 'Error validating channel access.' });
    return;
  }
};
