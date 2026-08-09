ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage_entered_at" bigint;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lost_reason" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_step" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_step_due_at" bigint;

CREATE TABLE IF NOT EXISTS "lead_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_events_lead_id_idx" ON "lead_events" ("lead_id");