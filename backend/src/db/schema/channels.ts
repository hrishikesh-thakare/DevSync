import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { workspaces } from './workspaces.js';
import { projects } from './projects.js';
import { customType } from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ─── channels ────────────────────────────────────────────────────────────────
export const channels = pgTable('channels', {
  channelId:          uuid('channel_id').primaryKey().defaultRandom(),
  workspaceId:        uuid('workspace_id').references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
  projectId:          uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }), // NULL = workspace-level
  name:               varchar('name', { length: 80 }),
  slug:               varchar('slug', { length: 80 }),
  description:        text('description'),
  type:               varchar('type', { length: 20 }).notNull(), // public|private|dm|group_dm
  isDefault:          boolean('is_default').default(false),
  isArchived:         boolean('is_archived').default(false),
  isAnnouncementOnly: boolean('is_announcement_only').default(false),
  createdBy:          uuid('created_by').references(() => users.userId, { onDelete: 'set null' }),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('channels_workspace_slug_unique').on(table.workspaceId, table.slug),
]);

// ─── channel_members ─────────────────────────────────────────────────────────
export const channelMembers = pgTable('channel_members', {
  id:        uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.channelId, { onDelete: 'cascade' }),
  userId:    uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  joinedAt:  timestamp('joined_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('channel_members_channel_user_unique').on(table.channelId, table.userId),
]);

// ─── messages ────────────────────────────────────────────────────────────────
// NOTE: body_tsv (TSVECTOR GENERATED ALWAYS AS ...) is handled via
// custom migration SQL — Drizzle does not support generated columns natively.
export const messages = pgTable('messages', {
  messageId:  uuid('message_id').primaryKey().defaultRandom(),
  channelId:  uuid('channel_id').references(() => channels.channelId, { onDelete: 'cascade' }),
  authorId:   uuid('author_id').references(() => users.userId, { onDelete: 'set null' }),
  isSystem:   boolean('is_system').default(false),
  systemType: varchar('system_type', { length: 30 }),
  bodyText:   text('body_text').notNull().default(''),
  bodyBlocks: jsonb('body_blocks'),
  bodyTsv:    tsvector('body_tsv'),
  threadId:   uuid('thread_id'), // self-ref FK to messages, added in migration
  replyCount: integer('reply_count').default(0),
  isEdited:   boolean('is_edited').default(false),
  isDeleted:  boolean('is_deleted').default(false),
  isPinned:   boolean('is_pinned').default(false),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── workspace_files ─────────────────────────────────────────────────────────
export const workspaceFiles = pgTable('workspace_files', {
  fileId:      uuid('file_id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
  uploaderId:  uuid('uploader_id').references(() => users.userId, { onDelete: 'set null' }),
  filename:    varchar('filename', { length: 255 }).notNull(),
  storagePath: text('storage_path').notNull(), // Supabase Storage bucket path
  mimetype:    varchar('mimetype', { length: 100 }),
  sizeBytes:   bigint('size_bytes', { mode: 'number' }),
  filetype:    varchar('filetype', { length: 20 }), // image|pdf|code|video|audio|other
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [channels.workspaceId], references: [workspaces.workspaceId] }),
  project:   one(projects, { fields: [channels.projectId], references: [projects.projectId] }),
  creator:   one(users, { fields: [channels.createdBy], references: [users.userId] }),
  members:   many(channelMembers),
  messages:  many(messages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, { fields: [channelMembers.channelId], references: [channels.channelId] }),
  user:    one(users, { fields: [channelMembers.userId], references: [users.userId] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.channelId] }),
  author:  one(users, { fields: [messages.authorId], references: [users.userId] }),
  parent:  one(messages, { fields: [messages.threadId], references: [messages.messageId], relationName: 'thread' }),
  replies: many(messages, { relationName: 'thread' }),
  reactions: many(messageReactions),
}));

export const workspaceFilesRelations = relations(workspaceFiles, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceFiles.workspaceId], references: [workspaces.workspaceId] }),
  uploader:  one(users, { fields: [workspaceFiles.uploaderId], references: [users.userId] }),
}));

// ─── message_reactions ───────────────────────────────────────────────────────
export const messageReactions = pgTable('message_reactions', {
  reactionId: uuid('reaction_id').primaryKey().defaultRandom(),
  messageId:  uuid('message_id').references(() => messages.messageId, { onDelete: 'cascade' }).notNull(),
  userId:     uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  emoji:      varchar('emoji', { length: 20 }).notNull(), // e.g. "👍", "smile"
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('message_reactions_unique').on(table.messageId, table.userId, table.emoji),
]);

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, { fields: [messageReactions.messageId], references: [messages.messageId] }),
  user:    one(users, { fields: [messageReactions.userId], references: [users.userId] }),
}));
