ALTER TABLE "projects" DROP CONSTRAINT "projects_workspace_key_unique";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_key_unique" ON "projects" USING btree ("workspace_id","key") WHERE "projects"."deleted_at" IS NULL;