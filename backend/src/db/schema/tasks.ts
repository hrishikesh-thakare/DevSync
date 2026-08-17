import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { projects } from './projects.js';
import { customType } from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ─── tasks ───────────────────────────────────────────────────────────────────
// NOTE: description_tsv (TSVECTOR GENERATED ALWAYS AS ...) is handled via
// custom migration SQL — Drizzle does not support generated columns natively.
// The discussion_thread_id FK to messages is also added in migration SQL
// to avoid circular dependency with the channels schema.
export const tasks = pgTable('tasks', {
  taskId:             uuid('task_id').primaryKey().defaultRandom(),
  taskKey:            varchar('task_key', { length: 20 }).notNull(),
  projectId:          uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  parentTaskId:       uuid('parent_task_id'),  // self-ref: FK added in migration
  epicId:             uuid('epic_id'),          // self-ref: FK added in migration
  sprintId:           uuid('sprint_id'),        // FK to sprints added in migration (circular)
  title:              varchar('title', { length: 500 }).notNull(),
  description:        jsonb('description').default({}),
  descriptionText:    text('description_text').default(''),
  descriptionTsv:     tsvector('description_tsv'),
  issueType:          varchar('issue_type', { length: 20 }).default('task'),      // epic|story|task|bug|subtask
  status:             varchar('status', { length: 30 }).default('todo'),          // todo|in_progress|in_review|done
  priority:           varchar('priority', { length: 20 }).default('medium'),      // critical|high|medium|low
  reporterId:         uuid('reporter_id').references(() => users.userId, { onDelete: 'set null' }),
  assigneeId:         uuid('assignee_id').references(() => users.userId, { onDelete: 'set null' }),
  dueDate:            timestamp('due_date', { mode: 'date', withTimezone: false }),
  labels:             jsonb('labels').default([]),           // flat array: ["frontend", "bug"]
  rank:               varchar('rank', { length: 255 }),     // Lexorank string
  aiDurationEstimate: numeric('ai_duration_estimate', { precision: 6, scale: 2 }),
  linkedCommitsCount: integer('linked_commits_count').default(0),
  discussionThreadId: uuid('discussion_thread_id'),         // FK to messages, added in migration
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt:          timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('tasks_project_task_key_unique').on(table.projectId, table.taskKey),
]);

// ─── Relations ───────────────────────────────────────────────────────────────
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project:    one(projects, { fields: [tasks.projectId], references: [projects.projectId] }),
  // NOTE: reverse relation to workspace_files omitted to avoid a circular
  // import (channels.ts -> tasks.ts). FK lives on workspace_files.task_id.
  reporter:   one(users, { fields: [tasks.reporterId], references: [users.userId] }),
  assignee:   one(users, { fields: [tasks.assigneeId], references: [users.userId] }),
  parentTask: one(tasks, { fields: [tasks.parentTaskId], references: [tasks.taskId], relationName: 'subtasks' }),
  epic:       one(tasks, { fields: [tasks.epicId], references: [tasks.taskId], relationName: 'epicTasks' }),
}));
