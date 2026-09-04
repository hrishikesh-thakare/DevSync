import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';

// ─── github_connections ──────────────────────────────────────────────────────
export const githubConnections = pgTable('github_connections', {
  connectionId:     uuid('connection_id').primaryKey().defaultRandom(),
  projectId:        uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }).unique(),
  connectedBy:      uuid('connected_by').references(() => users.userId, { onDelete: 'set null' }),
  githubRepoFullName: varchar('github_repo_full_name', { length: 300 }).notNull(),
  githubRepoId:     bigint('github_repo_id', { mode: 'number' }),
  defaultBranch:    varchar('default_branch', { length: 200 }).default('main'),
  githubAccessToken: text('github_access_token'), // encrypted
  webhookId:        bigint('webhook_id', { mode: 'number' }),
  webhookSecret:    text('webhook_secret'), // encrypted
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── github_commits ──────────────────────────────────────────────────────────
export const githubCommits = pgTable('github_commits', {
  id:                uuid('id').primaryKey().defaultRandom(),
  projectId:         uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  taskId:            uuid('task_id').references(() => tasks.taskId, { onDelete: 'set null' }),
  commitSha:         varchar('commit_sha', { length: 40 }).notNull(),
  repoFullName:      varchar('repo_full_name', { length: 300 }).notNull(),
  message:           text('message').notNull(),
  messageHeadline:   varchar('message_headline', { length: 200 }).notNull(),
  authorName:        varchar('author_name', { length: 200 }),
  authorGithubLogin: varchar('author_github_login', { length: 100 }),
  authorUserId:      uuid('author_user_id').references(() => users.userId, { onDelete: 'set null' }),
  committedAt:       timestamp('committed_at', { withTimezone: true }).notNull(),
  branchName:        varchar('branch_name', { length: 200 }),
  url:               text('url'),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('github_commits_repo_sha_unique').on(table.repoFullName, table.commitSha),
]);

// ─── github_ci_status ────────────────────────────────────────────────────────
export const githubCiStatus = pgTable('github_ci_status', {
  id:           uuid('id').primaryKey().defaultRandom(),
  projectId:    uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  workflowName: varchar('workflow_name', { length: 200 }),
  runId:        bigint('run_id', { mode: 'number' }).notNull(),
  status:       varchar('status', { length: 30 }).notNull(), // queued|in_progress|completed
  conclusion:   varchar('conclusion', { length: 30 }),       // success|failure|cancelled|skipped
  headBranch:   varchar('head_branch', { length: 200 }),
  headSha:      varchar('head_sha', { length: 40 }),
  htmlUrl:      text('html_url'),
  triggeredAt:  timestamp('triggered_at', { withTimezone: true }).notNull(),
  completedAt:  timestamp('completed_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  // The webhook handler treats this pair as a key — select, then update or
  // insert. GitHub sends three events per run (queued/in_progress/completed),
  // so without the constraint two concurrent deliveries could both miss the
  // select and both insert.
  uniqueIndex('github_ci_status_project_run_unique').on(table.projectId, table.runId),
]);

// ─── github_issues ───────────────────────────────────────────────────────────
export const githubIssues = pgTable('github_issues', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  projectId:          uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  taskId:             uuid('task_id').references(() => tasks.taskId, { onDelete: 'set null' }),
  githubIssueNumber:  integer('github_issue_number').notNull(),
  githubIssueId:      bigint('github_issue_id', { mode: 'number' }),
  title:              varchar('title', { length: 500 }).notNull(),
  body:               text('body'),
  state:              varchar('state', { length: 20 }).default('open'),  // open|closed
  htmlUrl:            text('html_url'),
  authorGithubLogin:  varchar('author_github_login', { length: 100 }),
  authorUserId:       uuid('author_user_id').references(() => users.userId, { onDelete: 'set null' }),
  labels:             jsonb('labels').default([]),
  closedAt:           timestamp('closed_at', { withTimezone: true }),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('github_issues_project_number_unique').on(table.projectId, table.githubIssueNumber),
]);

// ─── github_pull_requests ────────────────────────────────────────────────────
export const githubPullRequests = pgTable('github_pull_requests', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  projectId:          uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  taskId:             uuid('task_id').references(() => tasks.taskId, { onDelete: 'set null' }),
  prNumber:           integer('pr_number').notNull(),
  githubPrId:         bigint('github_pr_id', { mode: 'number' }),
  title:              varchar('title', { length: 500 }).notNull(),
  body:               text('body'),
  state:              varchar('state', { length: 20 }).default('open'),  // open|closed|merged
  htmlUrl:            text('html_url'),
  headBranch:         varchar('head_branch', { length: 200 }),
  baseBranch:         varchar('base_branch', { length: 200 }),
  authorGithubLogin:  varchar('author_github_login', { length: 100 }),
  authorUserId:       uuid('author_user_id').references(() => users.userId, { onDelete: 'set null' }),
  mergedAt:           timestamp('merged_at', { withTimezone: true }),
  closedAt:           timestamp('closed_at', { withTimezone: true }),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('github_prs_project_number_unique').on(table.projectId, table.prNumber),
]);

// ─── github_branches ─────────────────────────────────────────────────────────
export const githubBranches = pgTable('github_branches', {
  id:               uuid('id').primaryKey().defaultRandom(),
  projectId:        uuid('project_id').references(() => projects.projectId, { onDelete: 'cascade' }),
  taskId:           uuid('task_id').references(() => tasks.taskId, { onDelete: 'set null' }),
  branchName:       varchar('branch_name', { length: 200 }).notNull(),
  isDeleted:        boolean('is_deleted').default(false),
  createdByUserId:  uuid('created_by_user_id').references(() => users.userId, { onDelete: 'set null' }),
  htmlUrl:          text('html_url'),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('github_branches_project_name_unique').on(table.projectId, table.branchName),
]);

// ─── Relations ───────────────────────────────────────────────────────────────
export const githubConnectionsRelations = relations(githubConnections, ({ one }) => ({
  project:   one(projects, { fields: [githubConnections.projectId], references: [projects.projectId] }),
  connector: one(users, { fields: [githubConnections.connectedBy], references: [users.userId] }),
}));

export const githubCommitsRelations = relations(githubCommits, ({ one }) => ({
  project:    one(projects, { fields: [githubCommits.projectId], references: [projects.projectId] }),
  task:       one(tasks, { fields: [githubCommits.taskId], references: [tasks.taskId] }),
  authorUser: one(users, { fields: [githubCommits.authorUserId], references: [users.userId] }),
}));

export const githubCiStatusRelations = relations(githubCiStatus, ({ one }) => ({
  project: one(projects, { fields: [githubCiStatus.projectId], references: [projects.projectId] }),
}));

export const githubIssuesRelations = relations(githubIssues, ({ one }) => ({
  project:    one(projects, { fields: [githubIssues.projectId], references: [projects.projectId] }),
  task:       one(tasks, { fields: [githubIssues.taskId], references: [tasks.taskId] }),
  authorUser: one(users, { fields: [githubIssues.authorUserId], references: [users.userId] }),
}));

export const githubPullRequestsRelations = relations(githubPullRequests, ({ one }) => ({
  project:    one(projects, { fields: [githubPullRequests.projectId], references: [projects.projectId] }),
  task:       one(tasks, { fields: [githubPullRequests.taskId], references: [tasks.taskId] }),
  authorUser: one(users, { fields: [githubPullRequests.authorUserId], references: [users.userId] }),
}));

export const githubBranchesRelations = relations(githubBranches, ({ one }) => ({
  project:       one(projects, { fields: [githubBranches.projectId], references: [projects.projectId] }),
  task:          one(tasks, { fields: [githubBranches.taskId], references: [tasks.taskId] }),
  createdByUser: one(users, { fields: [githubBranches.createdByUserId], references: [users.userId] }),
}));
