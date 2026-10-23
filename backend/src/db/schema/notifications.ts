import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { workspaces } from './workspaces.js';

// ─── notifications ───────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  notificationId: uuid('notification_id').primaryKey().defaultRandom(),
  workspaceId:    uuid('workspace_id').references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
  recipientId:    uuid('recipient_id').references(() => users.userId, { onDelete: 'cascade' }),
  actorId:        uuid('actor_id').references(() => users.userId, { onDelete: 'set null' }),
  type:           varchar('type', { length: 50 }).notNull(),
  // type values:
  //   task_assigned | task_mentioned | task_commented
  //   sprint_closed | sprint_started
  //   channel_mentioned | dm_received
  //   ci_failed | ci_passed | commit_linked | commit_unlinked
  entityType:     varchar('entity_type', { length: 30 }).notNull(), // task|sprint|message|project
  entityId:       uuid('entity_id').notNull(),
  title:          varchar('title', { length: 255 }),
  body:           text('body'),
  isRead:         boolean('is_read').default(false),
  readAt:         timestamp('read_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const notificationsRelations = relations(notifications, ({ one }) => ({
  workspace: one(workspaces, { fields: [notifications.workspaceId], references: [workspaces.workspaceId] }),
  recipient: one(users, { fields: [notifications.recipientId], references: [users.userId] }),
  actor:     one(users, { fields: [notifications.actorId], references: [users.userId] }),
}));
