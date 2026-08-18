ALTER TABLE "tasks" ADD COLUMN "story_points" integer;--> statement-breakpoint
CREATE INDEX "workspace_files_task_id_idx" ON "workspace_files" USING btree ("task_id");