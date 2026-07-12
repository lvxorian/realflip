ALTER TABLE "activity_log" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "is_active" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "is_active" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "last_triggered" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "property_analysis" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "property_analysis" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "deal_expenses" ALTER COLUMN "date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "deal_expenses" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "purchase_date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "sell_date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "expires_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "call_logs" ALTER COLUMN "called_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "call_logs" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "call_queue" ALTER COLUMN "scheduled_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "call_queue" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "market_data" ALTER COLUMN "date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "market_data" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "price_history" ALTER COLUMN "recorded_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "first_seen" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "last_seen" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "is_active" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "is_active" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ALTER COLUMN "started_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ALTER COLUMN "finished_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "expires" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "onboarding_completed" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "verification_tokens" ALTER COLUMN "expires" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "price_per_sqm" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "market_price_min" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "market_price_max" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "overpricing_pct" real;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "location_category" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "location_city" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "location_district" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "segment_rating" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "occupancy" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "building_type" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "energy_label" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "technical_score" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "verdict_level" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "verdict_summary" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "red_flags_json" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "costs_json" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "alternative_strategies_json" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "rental_yield" real;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "building_type" text;