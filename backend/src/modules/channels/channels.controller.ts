import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../../config/db.js';
import { channels, channelMembers } from '../../db/schema/channels.js';
import { workspaceMembers } from '../../db/schema/workspaces.js';
import { projectMembers } from '../../db/schema/projects.js';
import { users } from '../../db/schema/auth.js';
import { eq, and, or, isNull, isNotNull, inArray, asc, sql } from 'drizzle-orm';
import { logAuditAction } from '../audit/audit.controller.js';
import { getIO } from '../../sockets/index.js';
import { createZoomMeeting, endZoomMeeting } from '../../lib/zoom.js';
import { getActiveCall, setActiveCall, clearActiveCall } from './activeCalls.js';

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
    // `(workspaceId, slug)` is unique (see `channels.ts`'s schema comment).
    // Every unnamed channel used to get the literal empty string here, which
    // means the *second* one ever created in a workspace collided on that
    // constraint — confirmed directly: creating a DM 500'd with a duplicate-
    // key violation the moment one unnamed channel already existed. DMs are
    // never looked up by slug (only by `channelId`), so a random one costs
    // nothing and can never collide with a real name or with each other.
    const slug = channelName ? channelSlug(channelName) : `_${randomUUID()}`;
    const isDirect = channelType === 'dm' || channelType === 'group_dm';

    // The route only requires being a workspace member at all (any role can
    // start a conversation, same as Teams/Slack DMs) — public/private
    // channels are still admin/owner-only, same as before, checked here
    // rather than in the route since it depends on the request body.
    if (!isDirect && req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
      res.status(403).json({ error: 'Only a workspace owner or admin can create a channel.' });
      return;
    }

    if (isDirect && (!Array.isArray(memberIds) || memberIds.length === 0)) {
      res.status(400).json({ error: 'A direct message needs at least one other member.' });
      return;
    }

    // The full member set, deduped — this is what identifies a DM, not its
    // (client-supplied, usually absent) name. Two people who already have a
    // DM clicking "message" again must land back in the same channel, not
    // spawn a duplicate every time.
    const memberSet = isDirect
      ? Array.from(new Set<string>([userId, ...(memberIds as string[]).filter((id) => id !== userId)]))
      : null;

    if (memberSet) {
      const [existing] = await db
        .select({ channelId: channelMembers.channelId })
        .from(channelMembers)
        .innerJoin(channels, eq(channels.channelId, channelMembers.channelId))
        .where(and(eq(channels.workspaceId, workspaceId), eq(channels.type, channelType)))
        .groupBy(channelMembers.channelId)
        .having(
          // `inArray()`, not a raw `= any(${memberSet})` — the same "doubled
          // parens" pitfall `labels.controller.ts` already hit: Drizzle's
          // `sql` template serializes an interpolated JS array as a row
          // expression, `($3, $4)`, not a real Postgres array, so
          // `any(($3, $4))` is invalid SQL (confirmed directly against a
          // running query, not assumed). `inArray()` is Drizzle's own
          // dedicated helper for exactly this and generates a correct
          // `IN ($3, $4)`, already proven against a uuid column elsewhere in
          // this codebase (`messages.controller.ts`'s file-cleanup query).
          sql`count(*) filter (where ${inArray(channelMembers.userId, memberSet)}) = ${memberSet.length} and count(*) = ${memberSet.length}`,
        );

      // `channelMembers.channelId` is nullable at the type level (the FK
      // itself has no `.notNull()`), even though this join guarantees a real
      // value at runtime — narrow explicitly rather than asserting past it.
      if (existing?.channelId) {
        const [channel] = await db.select().from(channels).where(eq(channels.channelId, existing.channelId)).limit(1);
        res.status(200).json({ message: 'Channel already exists', channel });
        return;
      }
    }

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

      // For a dm/group_dm, `memberSet` (creator + everyone named, deduped) is
      // the membership, full stop — that set *is* the channel's identity, per
      // the existing-channel lookup above. Otherwise, same as before: the
      // creator plus whichever `memberIds` were also given.
      const memberIdsToAdd = memberSet
        ? memberSet
        : [userId, ...(Array.isArray(memberIds) ? memberIds.filter((mId: string) => mId !== userId) : [])];
      const newMembers = memberIdsToAdd.map((mId) => ({ channelId: channel.channelId, userId: mId }));

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
    if (err?.code === '23505' || err?.cause?.code === '23505' || errStr.includes('unique constraint') || errStr.includes('duplicate key')) {
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
    const isWorkspaceAdmin = workspaceRole === 'owner' || workspaceRole === 'admin';

    // Opt-in paging, same shape as tasks.controller.ts's listTasks — a hard
    // ceiling on top of the default "everything". This used to fetch every
    // channel in the workspace and filter visibility in memory; a LIMIT
    // applied to that raw, unfiltered query would silently drop channels the
    // caller can see (or even truncate before reaching ones they can), so
    // the visibility check moved into the query itself first.
    const MAX_LIMIT = 2000;
    const requestedLimit = parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : MAX_LIMIT;
    const requestedOffset = parseInt(String(req.query.offset ?? ''), 10);
    const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;

    // These two are naturally bounded by the caller's own memberships, not
    // the workspace's total size, so they were never the risk this paging
    // closes — kept as-is, just used to build the visibility condition below
    // instead of an in-memory filter.
    const userProjects = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    const userProjectIds = userProjects.map(p => p.projectId).filter((id): id is string => id !== null);

    const userChannels = await db
      .select({ channelId: channelMembers.channelId })
      .from(channelMembers)
      .where(eq(channelMembers.userId, userId));
    const userChannelIds = userChannels.map(c => c.channelId).filter((id): id is string => id !== null);

    // Mirrors the original in-memory filter's branching exactly: a
    // project-scoped channel's visibility never depends on its `type`
    // (only project membership, or workspace owner/admin), and a
    // workspace-scoped channel's visibility never depends on project
    // membership (only its `type` or explicit channel membership). The
    // admin "see everything" shortcut is withheld from dm/group_dm
    // specifically — same reasoning as `requireChannelAccess`'s fix: a DM is
    // private to its participants, full stop, and listing *which* DMs exist
    // (who's talking to whom) is exactly the kind of leak that reasoning
    // covers, not just reading their contents.
    const visibilityCondition = or(
      and(isNull(channels.projectId), eq(channels.type, 'public')),
      and(
        isNull(channels.projectId),
        inArray(channels.type, ['dm', 'group_dm']),
        userChannelIds.length > 0 ? inArray(channels.channelId, userChannelIds) : sql`false`,
      ),
      and(
        isWorkspaceAdmin
          ? sql`true`
          : and(
              isNull(channels.projectId),
              userChannelIds.length > 0 ? inArray(channels.channelId, userChannelIds) : sql`false`,
            ),
        sql`${channels.type} not in ('dm', 'group_dm')`,
      ),
      and(
        isNotNull(channels.projectId),
        isWorkspaceAdmin
          ? sql`true`
          : userProjectIds.length > 0
            ? inArray(channels.projectId, userProjectIds)
            : sql`false`,
      ),
    );

    const visibleChannels = await db
      .select()
      .from(channels)
      .where(and(eq(channels.workspaceId, workspaceId), eq(channels.isArchived, false), visibilityCondition))
      .orderBy(asc(channels.createdAt))
      .limit(limit)
      .offset(offset);

    // DMs and group DMs have no name — the frontend needs to know *who* a
    // conversation is with to show anything meaningful in a channel list
    // (sidebar, "Direct Messages" section). One extra query for the whole
    // page of results rather than one per DM.
    const directChannelIds = visibleChannels.filter((c) => c.type === 'dm' || c.type === 'group_dm').map((c) => c.channelId);
    let participantsByChannel = new Map<string, { userId: string; fullName: string; displayName: string | null; avatarUrl: string | null }[]>();
    if (directChannelIds.length > 0) {
      const rows = await db
        .select({
          channelId: channelMembers.channelId,
          userId: users.userId,
          fullName: users.fullName,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(channelMembers)
        .innerJoin(users, eq(users.userId, channelMembers.userId))
        .where(and(inArray(channelMembers.channelId, directChannelIds), sql`${channelMembers.userId} != ${userId}`));

      participantsByChannel = new Map();
      for (const row of rows) {
        if (!row.channelId) continue;
        const list = participantsByChannel.get(row.channelId) ?? [];
        list.push({ userId: row.userId, fullName: row.fullName, displayName: row.displayName, avatarUrl: row.avatarUrl });
        participantsByChannel.set(row.channelId, list);
      }
    }

    const result = visibleChannels.map((c) =>
      c.type === 'dm' || c.type === 'group_dm'
        ? { ...c, otherParticipants: participantsByChannel.get(c.channelId) ?? [] }
        : c,
    );

    res.json({ channels: result });
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

// ─── CALLS (Zoom link-out) ───────────────────────────────────────────────────
// A "Start call" mints a Zoom meeting the first time; everyone after reuses
// the same link (`getActiveCall`) until it ages out — see activeCalls.ts.
// There's no embed and no live participant count: once someone clicks
// through, they've left DevSync's page for Zoom's, which this backend has
// no visibility into.

// GET /api/workspaces/:workspaceId/channels/:channelId/call
export const getCall = async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const call = getActiveCall(channelId);
  res.json({ joinUrl: call?.joinUrl ?? null });
};

// POST /api/workspaces/:workspaceId/channels/:channelId/call
export const startCall = async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const existing = getActiveCall(channelId);
  if (existing) {
    res.status(200).json({ joinUrl: existing.joinUrl });
    return;
  }

  try {
    const [channel] = await db
      .select({ name: channels.name })
      .from(channels)
      .where(eq(channels.channelId, channelId))
      .limit(1);

    const { joinUrl, meetingId } = await createZoomMeeting(`DevSync — #${channel?.name ?? 'channel'}`);
    setActiveCall(channelId, { joinUrl, meetingId, createdAt: Date.now() });

    // Any tab already open on this channel updates its "Start call" button
    // to "Join call" immediately, without polling.
    getIO().to(`channel:${channelId}`).emit('call_started', {
      channelRoomId: `channel:${channelId}`,
      joinUrl,
    });

    res.status(201).json({ joinUrl });
  } catch (err) {
    console.error('Start call error:', err);
    res.status(502).json({ error: 'Could not start the call. Check the Zoom integration is configured.' });
  }
};

// DELETE /api/workspaces/:workspaceId/channels/:channelId/call
export const endCall = async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const call = getActiveCall(channelId);
  // Cleared and broadcast first, regardless of whether the Zoom API call
  // below succeeds: DevSync's own "is a call live" state shouldn't stay
  // stuck just because Zoom's side had a transient error, and every open
  // tab reverting to "Start call" is the visible part of this action.
  clearActiveCall(channelId);
  getIO().to(`channel:${channelId}`).emit('call_started', {
    channelRoomId: `channel:${channelId}`,
    joinUrl: null,
  });

  if (call) {
    try {
      await endZoomMeeting(call.meetingId);
    } catch (err) {
      // Non-fatal: most commonly the meeting already ended itself because
      // everyone had already left. DevSync's own state is already cleared.
      console.error('End Zoom meeting error (non-fatal):', err);
    }
  }

  res.status(200).json({ ended: true });
};
