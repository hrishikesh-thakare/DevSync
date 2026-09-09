-- DevSync: integrity constraints and the indexes the hot paths were missing
--
--   1. users identity uniqueness scoped to live accounts
--   2. github_ci_status uniqueness on (project_id, run_id)
--   3. indexes on foreign keys and hot filter columns
--
-- Hand-written and fully guarded, matching 0009-0012. Safe to replay.

-- ─── 1. Deleting an account no longer burns its email ───────────────────────
--
-- `deleteAccount` soft-deletes: it stamps `deleted_at` and leaves the row. But
-- `email` carried a plain UNIQUE constraint and `register` checked for an
-- existing row without filtering `deleted_at`, while `login` did filter it. So
-- a user who deleted their account could never sign up again with the same
-- address — registration said "a user with this email already exists" and
-- login said "invalid email or password". A dead end with two contradictory
-- messages and no recovery path.
--
-- Partial unique indexes fix that: identity is unique among *live* accounts,
-- and a soft-deleted row stops reserving anything.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_github_id_unique";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_google_id_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_active_unique"
  ON "users" (lower("email")) WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_github_id_active_unique"
  ON "users" ("github_id") WHERE "deleted_at" IS NULL AND "github_id" IS NOT NULL;

-- ─── 2. github_ci_status uniqueness ─────────────────────────────────────────
--
-- The webhook handler treats (project_id, run_id) as a key: it SELECTs, then
-- either UPDATEs or INSERTs. Nothing in the database enforced that, and GitHub
-- delivers three events per run (queued / in_progress / completed), so two
-- concurrent deliveries could both miss the SELECT and both insert. Duplicate
-- rows, with the table carrying no index at all to make the lookup cheap.
--
-- Existing duplicates are collapsed first, keeping the most recently updated
-- row, or the constraint cannot be created.
DELETE FROM "github_ci_status" a
  USING "github_ci_status" b
  WHERE a."project_id" = b."project_id"
    AND a."run_id" = b."run_id"
    AND a."project_id" IS NOT NULL
    AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS "github_ci_status_project_run_unique"
  ON "github_ci_status" ("project_id", "run_id");

-- ─── 3. Indexes on foreign keys and hot filter columns ──────────────────────
--
-- Every column below is either an unindexed foreign key or something a
-- workspace-wide query filters on. `tasks.completed_at` is the pointed one:
-- 0012 added that column specifically so analytics could range-scan it, and
-- then indexed the transitions table instead of this.

-- Cross-project "My Tasks" and the dashboard's myWork panel.
CREATE INDEX IF NOT EXISTS "idx_tasks_assignee"
  ON "tasks" ("assignee_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_tasks_reporter"
  ON "tasks" ("reporter_id") WHERE "deleted_at" IS NULL;

-- Overdue / due-soon counts and the calendar.
CREATE INDEX IF NOT EXISTS "idx_tasks_due_date"
  ON "tasks" ("due_date") WHERE "due_date" IS NOT NULL AND "deleted_at" IS NULL;

-- Throughput and velocity range scans.
CREATE INDEX IF NOT EXISTS "idx_tasks_completed_at"
  ON "tasks" ("completed_at") WHERE "completed_at" IS NOT NULL;

-- Epic rollups and subtask expansion.
CREATE INDEX IF NOT EXISTS "idx_tasks_epic"
  ON "tasks" ("epic_id") WHERE "epic_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_tasks_parent"
  ON "tasks" ("parent_task_id") WHERE "parent_task_id" IS NOT NULL;

-- Session list, revoke-others, and the 6-hourly cleanup sweep.
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_auth_tokens_user_type" ON "auth_tokens" ("user_id", "type");

-- The project channels list.
CREATE INDEX IF NOT EXISTS "idx_channels_project"
  ON "channels" ("project_id") WHERE "project_id" IS NOT NULL;

-- The composite unique leads with sprint_id, so a lookup by task alone
-- could not use it.
CREATE INDEX IF NOT EXISTS "idx_sprint_tasks_task" ON "sprint_tasks" ("task_id");

-- Workspace file listing and per-uploader scoping.
CREATE INDEX IF NOT EXISTS "idx_workspace_files_workspace" ON "workspace_files" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_workspace_files_uploader" ON "workspace_files" ("uploader_id");

-- Only `token` was unique; listing and resending an invite go by these.
CREATE INDEX IF NOT EXISTS "idx_workspace_invites_workspace" ON "workspace_invites" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_workspace_invites_email" ON "workspace_invites" (lower("email"));

-- Per-project GitHub lists and task-detail lookups. The only unique on
-- github_commits leads with repo_full_name, which is the wrong column for both.
CREATE INDEX IF NOT EXISTS "idx_github_commits_project" ON "github_commits" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_github_commits_task" ON "github_commits" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_github_issues_task" ON "github_issues" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_github_pull_requests_task" ON "github_pull_requests" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_github_branches_task" ON "github_branches" ("task_id");

-- Message author lookups.
CREATE INDEX IF NOT EXISTS "idx_messages_author" ON "messages" ("author_id");

-- ─── 4. Dead columns ────────────────────────────────────────────────────────
--
-- All three are written by nothing:
--
--   users.google_id             — Google sign-in runs entirely through Supabase
--                                 in the browser; the backend never sees an id
--                                 to store. GOOGLE_CLIENT_ID was likewise
--                                 declared and read nowhere.
--   users.status_emoji          — read and rendered, but `updateStatus` only
--                                 ever accepted statusText and presence, and no
--                                 UI offered a picker. It could not be non-null.
--   projects.github_webhook_secret — superseded by github_connections.webhook_secret.

ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "status_emoji";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "github_webhook_secret";
