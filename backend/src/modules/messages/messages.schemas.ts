import { z } from 'zod';

// Message text can contain sanitized HTML and is broadcast in real time to
// every channel member — cap it so one message can't bloat the DB or freeze
// clients. 10,000 chars is far beyond any legitimate chat message.
const MessageText = z
  .string({ required_error: 'Message text must be a string' })
  .min(1, 'Message cannot be empty')
  .max(10000, 'Message must be 10,000 characters or less');

// Rich-text message blocks (optional, server-authored only for now)
const MessageBlocks = z
  .array(z.record(z.unknown()))
  .max(200, 'Message cannot contain more than 200 blocks')
  .nullable()
  .optional();

// `isSystem`/`systemType` are deliberately absent. They are server-authored:
// the only writers are sprint and task automations, which insert directly. As
// client input `isSystem` was an announcement-channel bypass — the posting
// guard skipped the admin check whenever it was true, so any member could post
// to an announcement-only channel by sending `{"isSystem": true}`, styled as a
// system message. The schema is .strict(), so sending either is now a 400.
export const sendMessageSchema = z.object({
  bodyText: MessageText.optional(),
  bodyBlocks: MessageBlocks,
  threadId: z.string().uuid('Invalid thread ID format').nullable().optional(),
}).strict()
  .refine((data) => data.bodyText !== undefined || data.bodyBlocks !== undefined, {
    message: 'Message content is required (bodyText or bodyBlocks)',
    path: ['bodyText'],
  });

export const editMessageSchema = z.object({
  bodyText: MessageText.optional(),
  bodyBlocks: MessageBlocks,
  isPinned: z.boolean().optional(),
}).strict()
  .refine((data) => data.bodyText !== undefined || data.bodyBlocks !== undefined || data.isPinned !== undefined, {
    message: 'At least one field (bodyText, bodyBlocks, isPinned) is required',
  });

export const addReactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji cannot be empty').max(20, 'Emoji must be 20 characters or less'),
}).strict();