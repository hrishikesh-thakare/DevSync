import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';

// ─── sprints ─────────────────────────────────────────────────────────────────
export const sprints = pgTable('sprints', {
  sprintId:              uuid('sprint_id').primaryKey().defaultRandom(),
  projectId:             uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  name:                  varchar('name', { length: 200 }).notNull(),
  goal:                  text('goal'),
  status:                varchar('status', { length: 20 }).default('future'), // future|active|closed
  startDate:             timestamp('start_date', { withTimezone: true }),
  endDate:               timestamp('end_date', { withTimezone: true }),
  closedAt:              timestamp('closed_at', { withTimezone: true }),
  closedBy:              uuid('closed_by').references(() => users.userId, { onDelete: 'set null' }),
  velocityIssues:        integer('velocity_issues'),
  capacityPoints:        integer('capacity_points'),   // story-point capacity for the sprint (Jira-style)
  sequenceNumber:        integer('sequence_number').notNull(),
  aiSummary:             jsonb('ai_summary'),
  aiContributionReport:  jsonb('ai_contribution_report'),
  summaryMessageId:      uuid('summary_message_id'), // FK to messages added in migration (circular)
  createdAt:             timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('sprints_project_sequence_unique').on(table.projectId, table.sequenceNumber),
]);

// ─── sprint_tasks ────────────────────────────────────────────────────────────
export const sprintTasks = pgTable('sprint_tasks', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  sprintId:               uuid('sprint_id').references(() => sprints.sprintId, { onDelete: 'cascade' }),
  taskId:                 uuid('task_id').references(() => tasks.taskId, { onDelete: 'cascade' }),
  wasCompletedInSprint:   boolean('was_completed_in_sprint'),
}, (table) => [
  unique('sprint_tasks_sprint_task_unique').on(table.sprintId, table.taskId),
]);

// ─── Relations ───────────────────────────────────────────────────────────────
export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  project:     one(projects, { fields: [sprints.projectId], references: [projects.projectId] }),
  closedByUser: one(users, { fields: [sprints.closedBy], references: [users.userId] }),
  sprintTasks: many(sprintTasks),
}));

export const sprintTasksRelations = relations(sprintTasks, ({ one }) => ({
  sprint: one(sprints, { fields: [sprintTasks.sprintId], references: [sprints.sprintId] }),
  task:   one(tasks, { fields: [sprintTasks.taskId], references: [tasks.taskId] }),
}));
