import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { workspaces } from './workspaces.js';

// ─── projects ────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  projectId:           uuid('project_id').primaryKey().defaultRandom(),
  workspaceId:         uuid('workspace_id').references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
  name:                varchar('name', { length: 100 }).notNull(),
  key:                 varchar('key', { length: 10 }).notNull(), // e.g. "PROJ", immutable
  description:         text('description'),
  iconUrl:             text('icon_url'),
  leadUserId:          uuid('lead_user_id').references(() => users.userId, { onDelete: 'set null' }),
  githubRepoOwner:     varchar('github_repo_owner', { length: 100 }),
  githubRepoName:      varchar('github_repo_name', { length: 200 }),
  issueCounter:        integer('issue_counter').default(0),
  status:              varchar('status', { length: 20 }).default('active'), // active|archived
  createdAt:           timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('projects_workspace_key_unique').on(table.workspaceId, table.key),
]);

// ─── project_members ─────────────────────────────────────────────────────────
export const projectMembers = pgTable('project_members', {
  id:        uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  userId:    uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  role:      varchar('role', { length: 30 }).notNull(), // project_admin|developer|viewer
  addedBy:   uuid('added_by').references(() => users.userId, { onDelete: 'set null' }),
  addedAt:   timestamp('added_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('project_members_project_user_unique').on(table.projectId, table.userId),
]);

// ─── Relations ───────────────────────────────────────────────────────────────
export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.workspaceId] }),
  lead:      one(users, { fields: [projects.leadUserId], references: [users.userId] }),
  members:   many(projectMembers),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.projectId] }),
  user:    one(users, { fields: [projectMembers.userId], references: [users.userId] }),
  adder:   one(users, { fields: [projectMembers.addedBy], references: [users.userId] }),
}));
