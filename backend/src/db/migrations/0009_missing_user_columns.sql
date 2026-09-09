ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status_text" varchar(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status_emoji" varchar(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" jsonb DEFAULT '{}'::jsonb;
