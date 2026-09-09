-- ─── github_issues ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "github_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid REFERENCES "projects"("project_id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("task_id") ON DELETE SET NULL,
  "github_issue_number" integer NOT NULL,
  "github_issue_id" bigint,
  "title" varchar(500) NOT NULL,
  "body" text,
  "state" varchar(20) DEFAULT 'open',
  "html_url" text,
  "author_github_login" varchar(100),
  "author_user_id" uuid REFERENCES "users"("user_id") ON DELETE SET NULL,
  "labels" jsonb DEFAULT '[]'::jsonb,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_issues_project_number_unique" ON "github_issues" ("project_id", "github_issue_number");

-- ─── github_pull_requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "github_pull_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid REFERENCES "projects"("project_id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("task_id") ON DELETE SET NULL,
  "pr_number" integer NOT NULL,
  "github_pr_id" bigint,
  "title" varchar(500) NOT NULL,
  "body" text,
  "state" varchar(20) DEFAULT 'open',
  "html_url" text,
  "head_branch" varchar(200),
  "base_branch" varchar(200),
  "author_github_login" varchar(100),
  "author_user_id" uuid REFERENCES "users"("user_id") ON DELETE SET NULL,
  "merged_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_prs_project_number_unique" ON "github_pull_requests" ("project_id", "pr_number");

-- ─── github_branches ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "github_branches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid REFERENCES "projects"("project_id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("task_id") ON DELETE SET NULL,
  "branch_name" varchar(200) NOT NULL,
  "is_deleted" boolean DEFAULT false,
  "created_by_user_id" uuid REFERENCES "users"("user_id") ON DELETE SET NULL,
  "html_url" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_branches_project_name_unique" ON "github_branches" ("project_id", "branch_name");
