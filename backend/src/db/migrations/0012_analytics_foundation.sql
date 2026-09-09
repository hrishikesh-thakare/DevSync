-- DevSync: Analytics foundation
--
--   1. tasks.completed_at            — a real completion timestamp
--   2. task_status_transitions       — the analytics source of truth
--   3. backfill both from audit_logs — so charts are not empty on day one
--   4. audit_logs indexes            — the table every other hot table got in 0010
--
-- Metrics deliberately do NOT read audit_logs at query time: it is unindexed,
-- mixes ~30 action types behind JSONB, and logAuditAction swallows its own
-- write failures. It is used here once, as a backfill source, and no further.

-- ─── 1. tasks.completed_at ──────────────────────────────────────────────────
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;

-- ─── 2. task_status_transitions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "task_status_transitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks"("task_id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("project_id") ON DELETE CASCADE,
  "from_status" varchar(30),
  "to_status" varchar(30) NOT NULL,
  "actor_id" uuid REFERENCES "users"("user_id") ON DELETE SET NULL,
  "changed_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "task_status_transitions_project_changed_idx"
  ON "task_status_transitions" ("project_id", "changed_at");
CREATE INDEX IF NOT EXISTS "task_status_transitions_task_changed_idx"
  ON "task_status_transitions" ("task_id", "changed_at");

-- ─── 3. Backfill from audit_logs ────────────────────────────────────────────
-- Idempotent: the NOT EXISTS guard means re-running adds nothing. Both the
-- task.created row (status at creation) and every task.status_changed row are
-- replayed, so a task's history starts at its opening status rather than at
-- whatever its first later move happened to be.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM task_status_transitions LIMIT 1) THEN

    -- 3a. Opening status, from task.created
    INSERT INTO task_status_transitions (task_id, project_id, from_status, to_status, actor_id, changed_at)
    SELECT
      a.entity_id,
      t.project_id,
      NULL,
      COALESCE(a.new_values ->> 'status', 'todo'),
      a.actor_id,
      a.created_at
    FROM audit_logs a
    JOIN tasks t ON t.task_id = a.entity_id
    WHERE a.action = 'task.created'
      AND a.entity_type = 'task'
      AND a.entity_id IS NOT NULL;

    -- 3b. Every recorded move
    INSERT INTO task_status_transitions (task_id, project_id, from_status, to_status, actor_id, changed_at)
    SELECT
      a.entity_id,
      t.project_id,
      a.old_values ->> 'status',
      a.new_values ->> 'status',
      a.actor_id,
      a.created_at
    FROM audit_logs a
    JOIN tasks t ON t.task_id = a.entity_id
    WHERE a.action = 'task.status_changed'
      AND a.entity_type = 'task'
      AND a.entity_id IS NOT NULL
      AND a.new_values ->> 'status' IS NOT NULL;

  END IF;
END $$;

-- 3c. Derive completed_at from the most recent move into 'done'.
-- Only for tasks currently in 'done' — a task that was reopened has no
-- completion date, which is the point of not reusing updated_at.
UPDATE tasks t
SET completed_at = latest.changed_at
FROM (
  SELECT DISTINCT ON (task_id) task_id, changed_at
  FROM task_status_transitions
  WHERE to_status = 'done'
  ORDER BY task_id, changed_at DESC
) latest
WHERE t.task_id = latest.task_id
  AND t.status = 'done'
  AND t.completed_at IS NULL;

-- Fallback for tasks that are done but predate any audit trail. updated_at is
-- imprecise, but a wrong-by-a-bit date beats dropping the row from throughput.
UPDATE tasks
SET completed_at = updated_at
WHERE status = 'done'
  AND completed_at IS NULL;

-- ─── 4. audit_logs indexes ──────────────────────────────────────────────────
-- Missed by 0010, which indexed every other hot table. Both the
-- /api/audit/:entityType/:entityId endpoint and the dashboard activity query
-- are sequential scans without these.
CREATE INDEX IF NOT EXISTS "idx_audit_logs_workspace_created"
  ON "audit_logs" ("workspace_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity"
  ON "audit_logs" ("entity_type", "entity_id");
