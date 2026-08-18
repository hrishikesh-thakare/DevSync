import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { projects } from './projects.js';

// ─── project_labels ──────────────────────────────────────────────────────────
// Managed label entity per project. Tasks keep a flat array of label names
// (tasks.labels jsonb); this table is the source of truth for colors and
// canonical spelling. The lower(name) unique index reconciles case variants
// ("Frontend" vs "frontend") into a single label.
export const projectLabels = pgTable('project_labels', {
  labelId:    uuid('label_id').primaryKey().defaultRandom(),
  projectId:  uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  name:       varchar('name', { length: 50 }).notNull(),
  color:      varchar('color', { length: 7 }).notNull().default('#64748b'),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('project_labels_project_lower_name_unique').on(table.projectId, sql`lower(${table.name})`),
]);

export const projectLabelsRelations = relations(projectLabels, ({ one }) => ({
  project: one(projects, { fields: [projectLabels.projectId], references: [projects.projectId] }),
}));