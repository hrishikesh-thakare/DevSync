import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';

// ─── workspaces ──────────────────────────────────────────────────────────────
export const workspaces = pgTable('workspaces', {
  workspaceId: uuid('workspace_id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 100 }).notNull(),
  slug:        varchar('slug', { length: 50 }).unique().notNull(),
  iconUrl:     text('icon_url'),
  description: text('description'),
  ownerId:     uuid('owner_id').references(() => users.userId, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
});

// ─── workspace_members ───────────────────────────────────────────────────────
export const workspaceMembers = pgTable('workspace_members', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
  userId:      uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  role:        varchar('role', { length: 20 }).notNull(), // owner|admin|member
  invitedBy:   uuid('invited_by').references(() => users.userId, { onDelete: 'set null' }),
  joinedAt:    timestamp('joined_at', { withTimezone: true }).defaultNow(),
  state:       varchar('state', { length: 20 }).default('active'), // active|invited|deactivated
}, (table) => [
  unique('workspace_members_workspace_user_unique').on(table.workspaceId, table.userId),
]);

// ─── workspace_invites ───────────────────────────────────────────────────────
export const workspaceInvites = pgTable('workspace_invites', {
  inviteId: uuid('invite_id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  token: varchar('token', { length: 100 }).notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.userId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner:   one(users, { fields: [workspaces.ownerId], references: [users.userId] }),
  members: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.workspaceId] }),
  user:      one(users, { fields: [workspaceMembers.userId], references: [users.userId] }),
  inviter:   one(users, { fields: [workspaceMembers.invitedBy], references: [users.userId] }),
}));

export const workspaceInvitesRelations = relations(workspaceInvites, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceInvites.workspaceId], references: [workspaces.workspaceId] }),
  inviter:   one(users, { fields: [workspaceInvites.invitedBy], references: [users.userId] }),
}));
