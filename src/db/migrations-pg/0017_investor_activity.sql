ALTER TABLE "investors" ADD COLUMN "last_active_at" bigint;
ALTER TABLE "investors" ADD COLUMN "login_count" integer NOT NULL DEFAULT 0;
