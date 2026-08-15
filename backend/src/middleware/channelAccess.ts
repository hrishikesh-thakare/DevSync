import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db.js';
import { channels, channelMembers } from '../db/schema/channels.js';
import { projectMembers } from '../db/schema/projects.js';
import { eq, and } from 'drizzle-orm';

/**
 * Middleware to restrict access based on Channel membership.
 * Requires requireAuth to run first to populate req.user.
 * Also requires requireWorkspaceRole to run first so req.workspaceRole is set.
 */
export const requireChannelAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const channelId = req.params?.channelId || req.body?.channelId || req.query?.channelId;
    const workspaceRole = req.workspaceRole; // from requireWorkspaceRole

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

    // 2. Determine access based on channel scope and type
    if (channel.projectId) {
      // --- Project-Scoped Channel ---
      // Workspace admins/owners get implicit access to all project channels
      if (workspaceRole === 'owner' || workspaceRole === 'admin') {
        return next();
      }

      // Otherwise, the user MUST be a member of the project
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
      
      // If it's a private project channel (if those exist), we might need an explicit channelMember check here too.
      // But currently it seems project channels are public to the project, so project membership is enough.
      return next();

    } else {
      // --- Workspace-Scoped Channel ---
      
      // Public workspace channels are accessible to all workspace members
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
