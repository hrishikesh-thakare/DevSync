ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("workspace_id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_recipient_workspace" ON "notifications" ("recipient_id", "workspace_id", "is_read", "created_at" DESC);
--> statement-breakpoint
UPDATE "notifications" n
SET "workspace_id" = p."workspace_id"
FROM "tasks" t
JOIN "projects" p ON t."project_id" = p."project_id"
WHERE n."entity_type" = 'task' AND n."entity_id" = t."task_id" AND n."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "notifications" n
SET "workspace_id" = c."workspace_id"
FROM "messages" m
JOIN "channels" c ON m."channel_id" = c."channel_id"
WHERE n."entity_type" = 'message' AND n."entity_id" = m."message_id" AND n."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "notifications" n
SET "workspace_id" = p."workspace_id"
FROM "sprints" s
JOIN "projects" p ON s."project_id" = p."project_id"
WHERE n."entity_type" = 'sprint' AND n."entity_id" = s."sprint_id" AND n."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "notifications" n
SET "workspace_id" = p."workspace_id"
FROM "projects" p
WHERE n."entity_type" = 'project' AND n."entity_id" = p."project_id" AND n."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "notifications" n
SET "workspace_id" = n."entity_id"
WHERE n."entity_type" = 'workspace' AND n."workspace_id" IS NULL;
