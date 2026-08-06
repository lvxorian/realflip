ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "portal_visible" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "portal_status" text DEFAULT 'available';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "portal_reserved_investor_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT IF NOT EXISTS "leads_portal_reserved_investor_id_investors_id_fk" FOREIGN KEY ("portal_reserved_investor_id") REFERENCES "public"."investors"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN IF NOT EXISTS "portal_enabled" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN IF NOT EXISTS "portal_password_hash" text;
