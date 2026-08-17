ALTER TABLE "workspace_files" ADD COLUMN "task_id" uuid;--> statement-breakpoint
CREATE INDEX "workspace_files_task_id_idx" ON "workspace_files" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_task_id_tasks_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE cascade ON UPDATE no action;
