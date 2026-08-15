CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"property_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "favorites_user_id_property_id_pk" PRIMARY KEY("user_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "investor_offer_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"investor_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"sent_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"phone" text,
	"email" text,
	"budget" integer,
	"budget_unlimited" integer DEFAULT 0,
	"portal_enabled" integer DEFAULT 0,
	"preferred_model" text,
	"notes" text,
	"last_active_at" bigint,
	"login_count" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locality_metrics" (
	"city_key" text NOT NULL,
	"source" text NOT NULL,
	"period" text NOT NULL,
	"json_data" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	CONSTRAINT "locality_metrics_city_key_source_period_pk" PRIMARY KEY("city_key","source","period")
);
--> statement-breakpoint
CREATE TABLE "market_cache" (
	"city" text NOT NULL,
	"segment" text DEFAULT 'any' NOT NULL,
	"low" integer NOT NULL,
	"high" integer NOT NULL,
	"median" integer NOT NULL,
	"sample_size" integer NOT NULL,
	"source" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	"payload" text,
	CONSTRAINT "market_cache_city_segment_pk" PRIMARY KEY("city","segment")
);
--> statement-breakpoint
CREATE TABLE "poi_metrics" (
	"city_key" text NOT NULL,
	"district" text DEFAULT '' NOT NULL,
	"counts_json" text NOT NULL,
	"walkability" integer,
	"fetched_at" bigint NOT NULL,
	CONSTRAINT "poi_metrics_city_key_district_pk" PRIMARY KEY("city_key","district")
);
--> statement-breakpoint
CREATE TABLE "portal_config" (
	"id" text PRIMARY KEY NOT NULL,
	"fifty_fifty_enabled" integer DEFAULT 1,
	"fifty_fifty_notice" text DEFAULT '',
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realized_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"url" text,
	"portal_name" text,
	"title" text,
	"price" integer NOT NULL,
	"price_per_sqm" real,
	"area" real,
	"rooms" text,
	"condition" text,
	"building_type" text,
	"address" text,
	"lat" real,
	"lng" real,
	"sold_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rents" (
	"city_key" text NOT NULL,
	"segment" text DEFAULT 'any' NOT NULL,
	"rent_per_sqm" real,
	"median_rent" integer,
	"walkability" integer,
	"counts_json" text,
	"sample_size" integer NOT NULL,
	"fetched_at" bigint NOT NULL,
	CONSTRAINT "rents_city_key_segment_pk" PRIMARY KEY("city_key","segment")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_at" bigint,
	"priority" text DEFAULT 'medium' NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vykupy_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"debtor_name" text NOT NULL,
	"case_number" text NOT NULL,
	"address" text,
	"region" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"raw_data" jsonb DEFAULT '{}',
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "vykupy_leads_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "vykupy_regions" (
	"id" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "vykupy_regions_region_unique" UNIQUE("region")
);
--> statement-breakpoint
ALTER TABLE "calculator_presets" ALTER COLUMN "target_roi" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "calculator_presets" ALTER COLUMN "target_roi" SET DEFAULT 15;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "target_purchase_price" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "arv_price_per_sqm_high" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "market_source" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "market_sample_size" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "monthly_rent" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "cash_flow_monthly" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "calc_mode" text DEFAULT 'flip';--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "calc_snapshot" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "locality_score" integer;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "locality_factors_json" text;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "ai_locality_verdict" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "investor_id" text;--> statement-breakpoint
ALTER TABLE "calculator_presets" ADD COLUMN "mode" text DEFAULT 'flip' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stage_data" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "portal_visible" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "portal_status" text DEFAULT 'available';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "portal_reserved_investor_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "portal_reserved_model" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "portal_reserved_strategy" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "portal_reserved_at" bigint;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "portal_expires_at" bigint;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "position" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stage_entered_at" bigint;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_step" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_step_due_at" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "removed_at" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "area_locked" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "floor_area" real;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "usable_area" real;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "accessory_area" real;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "area_flag" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "auction_data_json" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "alt_portals" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_offer_emails" ADD CONSTRAINT "investor_offer_emails_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_offer_emails" ADD CONSTRAINT "investor_offer_emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realized_sales" ADD CONSTRAINT "realized_sales_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "investor_offer_emails_unique" ON "investor_offer_emails" USING btree ("investor_id","lead_id");--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_portal_reserved_investor_id_investors_id_fk" FOREIGN KEY ("portal_reserved_investor_id") REFERENCES "public"."investors"("id") ON DELETE set null ON UPDATE no action;