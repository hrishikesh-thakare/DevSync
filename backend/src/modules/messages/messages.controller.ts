import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { messages } from '../../db/schema/channels.js';
import { users } from '../../db/schema/auth.js';
import { eq, and, desc, asc, sql, or, ilike, inArray } from 'drizzle-orm';
import { getIO } from '../../sockets/index.js';
import { channels, channelMembers, workspaceFiles } from '../../db/schema/channels.js';
import { supabase } from '../../config/supabase.js';
import { tasks } from '../../db/schema/tasks.js';
import { createNotification } from '../notifications/notifications.controller.js';
import { workspaceMembers } from '../../db/schema/workspaces.js';
import { logAuditAction } from '../audit/audit.controller.js';

/**
 * Confirms a message actually belongs to the channel in the URL.
 *
 * `requireChannelAccess` runs one router up and authorises the **channel**, not
 * the message. Every handler below then looked the message up by `messageId`
 * alone, so any `:messageId` in the system could be paired with a `:channelId`
 * the caller happened to have access to — enough to read a private thread, pin
 * or unpin someone else's message, react to it, or (as a workspace admin of any
 * workspace at all) delete it. Scoping the lookup here closes all five paths.
 *
 * Returns null when the message does not exist *or* is not in this channel;
 * callers answer 404 either way, so the endpoint never confirms that an id
 * exists somewhere else.
 */
const findMessageInChannel = async (messageId: string, channelId: string) => {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.messageId, messageId), eq(messages.channelId, channelId)))
    .limit(1);
  return row ?? null;
};

// ─── SEND MESSAGE ────────────────────────────────────────────────────────────
// POST /api/channels/:channelId/messages
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { bodyText, bodyBlocks, threadId, isSystem, systemType } = req.body;

    if (!bodyText && !bodyBlocks) {
      res.status(400).json({ error: 'Message body cannot be empty.' });
      return;
    }

    // Check announcement-only channel restrictions
    const [channel] = await db
      .select({ isAnnouncementOnly: channels.isAnnouncementOnly, workspaceId: channels.workspaceId, type: channels.type, name: channels.name })
      .from(channels)
      .where(eq(channels.channelId, channelId));

    if (!channel) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }

    if (channel.isAnnouncementOnly && !isSystem) {
      const [member] = await db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, channel.workspaceId!), eq(workspaceMembers.userId, userId)));
      
      if (!member || !['owner', 'admin'].includes(member.role)) {
        res.status(403).json({ error: 'Only admins can post in announcement channels.' });
        return;
      }
    }

    const result = await db.transaction(async (tx) => {
      // 1. Insert message
      const [message] = await tx
        .insert(messages)
        .values({
          channelId,
          authorId: userId,
          bodyText: bodyText || '',
          bodyBlocks: bodyBlocks || null,
          threadId: threadId || null,
          isSystem: isSystem || false,
          systemType: systemType || null,
        })
        .returning();

      // 2. If it's a thread reply, increment parent's replyCount
      if (threadId) {
        await tx
          .update(messages)
          .set({ replyCount: sql`reply_count + 1`, updatedAt: new Date() })
          .where(eq(messages.messageId, threadId));
      }

      return message;
    });

    // Fetch author details to populate the real-time event
    const [author] = await db
      .select({ fullName: users.fullName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    const populatedMessage = {
      ...result,
      authorName: author?.fullName,
      authorAvatar: author?.avatarUrl,
    };

    // Emit real-time event
    const io = getIO();
    io.to(`channel:${channelId}`).emit('new_message', populatedMessage);

    // --- NOTIFICATIONS ---
    // 1. dm_received
    if ((channel.type === 'dm' || channel.type === 'group_dm') && !isSystem) {
      const dmParticipants = await db.select({ userId: channelMembers.userId }).from(channelMembers).where(eq(channelMembers.channelId, channelId));
      for (const participant of dmParticipants) {
        if (participant.userId !== userId) {
           await createNotification({
              recipientId: participant.userId as string,
              actorId: userId,
              type: 'dm_received',
              entityType: 'message',
              entityId: result.messageId,
              title: `New message from ${author?.fullName || 'Someone'}`,
              body: `'${(bodyText || '').replace(/<[^>]*>?/gm, '').substring(0, 100)}'`,
           });
        }
      }
    }

    // 2. task_commented (legacy thread replies)
    if (threadId && !isSystem) {
      const [task] = await db.select({ taskId: tasks.taskId, taskKey: tasks.taskKey, assigneeId: tasks.assigneeId, reporterId: tasks.reporterId }).from(tasks).where(eq(tasks.discussionThreadId, threadId));
      if (task) {
        const commenters = await db.selectDistinct({ userId: messages.authorId }).from(messages).where(eq(messages.threadId, threadId));
        
        const recipients = new Set<string>();
        if (task.assigneeId) recipients.add(task.assigneeId);
        if (task.reporterId) recipients.add(task.reporterId);
        for (const c of commenters) if (c.userId) recipients.add(c.userId);

        recipients.delete(userId);

        for (const recipientId of recipients) {
          await createNotification({
            recipientId,
            actorId: userId,
            type: 'task_commented',
            entityType: 'task',
            entityId: task.taskId,
            title: `New comment on ${task.taskKey}`,
            body: `${author?.fullName || 'Someone'}: '${(bodyText || '').replace(/<[^>]*>?/gm, '').substring(0, 100)}'`,
          });
        }
      }
    }

    // 3. channel_mentioned & task_mentioned
    if (bodyText && !isSystem && channel.type !== 'dm' && channel.type !== 'group_dm') {
      // User mentions (from Tiptap extension)
      let mentionedIds: string[] = [];
      const spanRegex = /<[^>]+>/g;
      const tagMatches = [...bodyText.matchAll(spanRegex)];
      for (const match of tagMatches) {
        const tag = match[0];
        if (tag.includes('data-type="mention"')) {
          const idMatch = tag.match(/data-id="([^"]+)"/);
          if (idMatch) mentionedIds.push(idMatch[1]);
        }
      }

      // Plain Text Fallback
      const plainRegex = /@([a-zA-Z0-9_-]+)/g;
      const plainMatches = [...bodyText.matchAll(plainRegex)];
      const plainUsernames = [...new Set(plainMatches.map(m => m[1]))];
      for (const username of plainUsernames) {
        if (!['all', 'everyone', 'channel'].includes(username.toLowerCase())) {
          const [mentionedUser] = await db.select({ id: users.userId }).from(users).where(or(ilike(users.displayName, username), ilike(users.fullName, username + '%'))).limit(1);
          if (mentionedUser) mentionedIds.push(mentionedUser.id);
        }
      }

      mentionedIds = [...new Set(mentionedIds)];

      // General tags (@all, @everyone, @channel)
      const generalTagRegex = /@(all|everyone|channel)\b/gi;
      if (generalTagRegex.test(bodyText)) {
        const allChannelMembers = await db.select({ userId: channelMembers.userId }).from(channelMembers).where(eq(channelMembers.channelId, channelId));
        const allMemberIds = allChannelMembers.map(m => m.userId).filter(id => id && id !== userId) as string[];
        mentionedIds = [...new Set([...mentionedIds, ...allMemberIds])];
      }

      if (mentionedIds.length > 0) {
        for (const mentionedId of mentionedIds) {
          if (mentionedId !== userId) {
            await createNotification({
              recipientId: mentionedId,
              actorId: userId,
              type: 'channel_mentioned',
              entityType: 'message',
              entityId: result.messageId,
              title: `${author?.fullName || 'Someone'} mentioned you in #${channel.name || 'channel'}`,
              body: `'${(bodyText || '').replace(/<[^>]*>?/gm, '').substring(0, 100)}...'`,
            });
          }
        }
      }

      // Task mentions
      const taskMentionRegex = /@([a-z]+-\d+)/gi;
      const taskMatches = [...bodyText.matchAll(taskMentionRegex)];
      if (taskMatches.length > 0) {
        const taskKeys = [...new Set(taskMatches.map(m => m[1]))];
        for (const key of taskKeys) {
          const [task] = await db.select({ taskId: tasks.taskId, taskKey: tasks.taskKey, assigneeId: tasks.assigneeId, reporterId: tasks.reporterId }).from(tasks).where(eq(tasks.taskKey, key));
          if (task) {
            const recipients = new Set<string>();
            if (task.assigneeId) recipients.add(task.assigneeId);
            if (task.reporterId) recipients.add(task.reporterId);
            recipients.delete(userId); // Don't notify the person mentioning the task

            for (const recipientId of recipients) {
              await createNotification({
                recipientId,
                actorId: userId,
                type: 'task_mentioned',
                entityType: 'message',
                entityId: result.messageId,
                title: `Task ${task.taskKey} was mentioned`,
                body: `${author?.fullName || 'Someone'} mentioned it in #${channel.name || 'channel'}`,
              });
            }
          }
        }
      }
    }

    res.status(201).json({ message: 'Message sent', data: populatedMessage });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error sending message.' });
  }
};

// ─── LIST MESSAGES (CHANNEL) ─────────────────────────────────────────────────
// GET /api/channels/:channelId/messages
export const listMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const { limit = 50, cursor, q } = req.query;

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);
    const searchQuery = typeof q === 'string' ? q.trim() : null;

    // Conditions: always filter by channelId
    const conditions = [eq(messages.channelId, channelId)];

    if (searchQuery) {
      // Search mode: search body text, do not restrict to threadId IS NULL (so replies are searchable)
      const searchCondition = or(
        sql`body_tsv @@ plainto_tsquery('english', ${searchQuery})`,
        ilike(messages.bodyText, `%${searchQuery}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    } else {
      // Normal mode: only fetch top-level messages (not in a thread)
      conditions.push(sql`${messages.threadId} IS NULL`);
    }

    const results = await db
      .select({
        messageId: messages.messageId,
        bodyText: messages.bodyText,
        bodyBlocks: messages.bodyBlocks,
        isSystem: messages.isSystem,
        systemType: messages.systemType,
        isEdited: messages.isEdited,
        isDeleted: messages.isDeleted,
        isPinned: messages.isPinned,
        replyCount: messages.replyCount,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        authorId: users.userId,
        authorName: users.fullName,
        authorAvatar: users.avatarUrl,
        threadId: messages.threadId,
      })
      .from(messages)
      .leftJoin(users, eq(messages.authorId, users.userId))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(parsedLimit);

    const messageIds = results.map(r => r.messageId);
    const reactionsMap: Record<string, any[]> = {};

    if (messageIds.length > 0) {
      const { messageReactions } = await import('../../db/schema/channels.js');
      const allReactions = await db
        .select({
          messageId: messageReactions.messageId,
          userId: messageReactions.userId,
          emoji: messageReactions.emoji,
          userName: users.fullName
        })
        .from(messageReactions)
        .leftJoin(users, eq(messageReactions.userId, users.userId))
        .where(inArray(messageReactions.messageId, messageIds));
        
      for (const rx of allReactions) {
        if (!reactionsMap[rx.messageId]) reactionsMap[rx.messageId] = [];
        reactionsMap[rx.messageId].push(rx);
      }
    }

    const enrichedResults = results.map(r => ({
      ...r,
      reactions: reactionsMap[r.messageId] || []
    })).reverse(); // Reverse so oldest is first for UI display

    res.json({ messages: enrichedResults }); 
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Server error listing messages.' });
  }
};

// ─── GET THREAD REPLIES ──────────────────────────────────────────────────────
// GET /api/channels/:channelId/messages/:messageId/thread
export const getThreadReplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, messageId } = req.params as Record<string, string>;

    // The thread root has to live in this channel, or any message id in the
    // system could be read through a channel the caller happens to be in.
    const root = await findMessageInChannel(messageId, channelId);
    if (!root) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    const results = await db
      .select({
        messageId: messages.messageId,
        bodyText: messages.bodyText,
        bodyBlocks: messages.bodyBlocks,
        isEdited: messages.isEdited,
        isDeleted: messages.isDeleted,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        authorId: users.userId,
        authorName: users.fullName,
        authorAvatar: users.avatarUrl,
      })
      .from(messages)
      .leftJoin(users, eq(messages.authorId, users.userId))
      .where(eq(messages.threadId, messageId))

      .orderBy(asc(messages.createdAt)); // Chronological order for threads

    const replyIds = results.map(r => r.messageId);
    const reactionsMap: Record<string, any[]> = {};

    if (replyIds.length > 0) {
      const { messageReactions } = await import('../../db/schema/channels.js');
      const allReactions = await db
        .select({
          messageId: messageReactions.messageId,
          userId: messageReactions.userId,
          emoji: messageReactions.emoji,
          userName: users.fullName
        })
        .from(messageReactions)
        .leftJoin(users, eq(messageReactions.userId, users.userId))
        .where(inArray(messageReactions.messageId, replyIds));
        
      for (const rx of allReactions) {
        if (!reactionsMap[rx.messageId]) reactionsMap[rx.messageId] = [];
        reactionsMap[rx.messageId].push(rx);
      }
    }

    const enrichedResults = results.map(r => ({
      ...r,
      reactions: reactionsMap[r.messageId] || []
    }));

    res.json({ replies: enrichedResults });
  } catch (err) {
    console.error('Get thread error:', err);
    res.status(500).json({ error: 'Server error fetching thread replies.' });
  }
};

// ─── EDIT MESSAGE ────────────────────────────────────────────────────────────
// PATCH /api/channels/:channelId/messages/:messageId
export const editMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, messageId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { bodyText, bodyBlocks, isPinned } = req.body;

    // Verify the message is in this channel, then ownership.
    const msg = await findMessageInChannel(messageId, channelId);

    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    if (msg.isDeleted) {
      res.status(400).json({ error: 'Cannot edit a deleted message.' });
      return;
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    
    // Only author can edit content
    if (bodyText !== undefined || bodyBlocks !== undefined) {
      if (msg.authorId !== userId) {
        res.status(403).json({ error: 'You can only edit your own messages.' });
        return;
      }
      if (bodyText !== undefined) updateData.bodyText = bodyText;
      if (bodyBlocks !== undefined) updateData.bodyBlocks = bodyBlocks;
      updateData.isEdited = true;
    }

    // Anyone with access to the route (channel members) can pin/unpin for now
    if (isPinned !== undefined) {
      updateData.isPinned = isPinned;
    }

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(messages)
        .set(updateData)
        .where(eq(messages.messageId, messageId))
        .returning();

      if (updated) {
        const [channel] = await tx.select({ workspaceId: channels.workspaceId }).from(channels).where(eq(channels.channelId, channelId)).limit(1);

        if (isPinned !== undefined && msg.isPinned !== isPinned) {
          await logAuditAction({
            actorId: userId,
            action: isPinned ? 'message.pinned' : 'message.unpinned',
            entityType: 'channel',
            entityId: channelId,
            workspaceId: channel?.workspaceId ?? undefined,
            newValues: { message_id: messageId },
            tx
          });
        }
      }
      return updated;
    });

    // Emit real-time event
    const io = getIO();
    io.to(`channel:${channelId}`).emit('message_updated', result);

    res.json({ message: 'Message updated', data: result });
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Server error editing message.' });
  }
};

// ─── SOFT DELETE MESSAGE ─────────────────────────────────────────────────────
// DELETE /api/channels/:channelId/messages/:messageId
export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, messageId } = req.params as Record<string, string>;
    const userId = req.user!.userId;

    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    if (!isUuid(messageId) || !isUuid(channelId)) {
      res.status(400).json({ error: 'Invalid message or channel id.' });
      return;
    }

    // Verify the message is in this channel, then ownership & fetch replyCount.
    const msg = await findMessageInChannel(messageId, channelId);

    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    let isDeletedByAdmin = false;
    if (msg.authorId !== userId) {
      const [channel] = await db.select({ workspaceId: channels.workspaceId }).from(channels).where(eq(channels.channelId, channelId)).limit(1);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found.' });
        return;
      }
      const [member] = await db.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, channel.workspaceId!), eq(workspaceMembers.userId, userId)));
      
      if (!member || !['owner', 'admin'].includes(member.role)) {
        res.status(403).json({ error: 'You can only delete your own messages.' });
        return;
      }
      isDeletedByAdmin = true;
    }
    
    // Extract fileIds from the message body
    let filesToDelete: string[] = [];
    if (msg.bodyText) {
      const fileMatches = Array.from(msg.bodyText.matchAll(/\[(.*?)\]\(file:([a-zA-Z0-9-]+)\)/g));
      filesToDelete = fileMatches.map(m => m[2]);
    }

    await db.transaction(async (tx) => {
      // If deleting a child reply, decrement parent's replyCount
      if (msg.threadId) {
        await tx
          .update(messages)
          .set({ replyCount: sql`GREATEST(0, reply_count - 1)`, updatedAt: new Date() })
          .where(eq(messages.messageId, msg.threadId));

        // If parent was soft-deleted and now has 0 replies, hard delete parent too
        const [parent] = await tx
          .select({ isDeleted: messages.isDeleted, replyCount: messages.replyCount })
          .from(messages)
          .where(eq(messages.messageId, msg.threadId));

        if (parent && parent.isDeleted && (parent.replyCount || 0) <= 0) {
          await tx.delete(messages).where(eq(messages.messageId, msg.threadId));
        }
      }

      // If parent message has active thread replies (> 0), soft delete to preserve thread tree
      if ((msg.replyCount || 0) > 0) {
        await tx
          .update(messages)
          .set({
            isDeleted: true,
            bodyText: 'This message was deleted.',
            bodyBlocks: null,
            updatedAt: new Date(),
          })
          .where(eq(messages.messageId, messageId));
      } else {
        // Standalone message or child reply with 0 replies: Hard delete completely
        await tx
          .delete(messages)
          .where(eq(messages.messageId, messageId));
      }
      
      // Handle file deletion
      if (filesToDelete.length > 0) {
        const files = await tx.select({ fileId: workspaceFiles.fileId, storagePath: workspaceFiles.storagePath })
           .from(workspaceFiles)
           .where(inArray(workspaceFiles.fileId, filesToDelete));
        
        if (files.length > 0) {
           const storagePaths = files.map(f => f.storagePath);
           
           // Delete from DB
           await tx.delete(workspaceFiles).where(inArray(workspaceFiles.fileId, filesToDelete));
           
           // Delete from Supabase
           const { error: storageError } = await supabase.storage.from('workspace-files').remove(storagePaths);
           if (storageError) {
              console.error("Failed to delete files from Supabase", storageError);
           }
        }
      }

      if (isDeletedByAdmin) {



        const [channel] = await tx.select({ workspaceId: channels.workspaceId }).from(channels).where(eq(channels.channelId, channelId)).limit(1);
        await logAuditAction({
          actorId: userId,
          action: 'message.deleted_by_admin',
          entityType: 'channel',
          entityId: channelId,
          workspaceId: channel?.workspaceId ?? undefined,
          newValues: { message_id: messageId, original_author: msg.authorId },
          tx
        });
      }
    });

    // Emit real-time event
    const io = getIO();
    io.to(`channel:${channelId}`).emit('message_deleted', { messageId, threadId: msg.threadId });

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Server error deleting message.' });
  }
};

// ─── ADD REACTION ────────────────────────────────────────────────────────────
// POST /api/channels/:channelId/messages/:messageId/reactions
export const addReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, messageId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { emoji } = req.body;

    if (!emoji) {
      res.status(400).json({ error: 'Emoji is required.' });
      return;
    }

    // Without this, a reaction could be written onto any message in any
    // workspace — the insert only ever referenced the message id.
    const target = await findMessageInChannel(messageId, channelId);
    if (!target) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    const { messageReactions } = await import('../../db/schema/channels.js');

    await db
      .insert(messageReactions)
      .values({ messageId, userId, emoji })
      .onConflictDoNothing(); // If already reacted, do nothing

    const [userRecord] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.userId, userId)).limit(1);

    const io = getIO();
    io.to(`channel:${channelId}`).emit('message_reaction_added', { messageId, userId, emoji, userName: userRecord?.fullName || 'User' });

    res.json({ message: 'Reaction added' });
  } catch (err) {
    console.error('Add reaction error:', err);
    res.status(500).json({ error: 'Server error adding reaction.' });
  }
};

// ─── REMOVE REACTION ─────────────────────────────────────────────────────────
// DELETE /api/channels/:channelId/messages/:messageId/reactions/:emoji
export const removeReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, messageId, emoji } = req.params as Record<string, string>;
    const userId = req.user!.userId;

    const target = await findMessageInChannel(messageId, channelId);
    if (!target) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    const { messageReactions } = await import('../../db/schema/channels.js');

    await db
      .delete(messageReactions)
      .where(and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      ));

    const io = getIO();
    io.to(`channel:${channelId}`).emit('message_reaction_removed', { messageId, userId, emoji });

    res.json({ message: 'Reaction removed' });
  } catch (err) {
    console.error('Remove reaction error:', err);
    res.status(500).json({ error: 'Server error removing reaction.' });
  }
};
