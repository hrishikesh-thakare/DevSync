CREATE TABLE "project_labels" (
	"label_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" varchar(50) NOT NULL,
	"color" varchar(7) DEFAULT '#64748b' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "project_labels" ADD CONSTRAINT "project_labels_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_labels_project_lower_name_unique" ON "project_labels" USING btree ("project_id",lower("name"));