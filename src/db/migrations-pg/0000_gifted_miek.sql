CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"property_id" text,
	"data" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"conditions" text,
	"channels" text DEFAULT '["in_app"]',
	"is_active" boolean DEFAULT true,
	"last_triggered" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"type" text DEFAULT 'info',
	"read" boolean DEFAULT false,
	"data" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"market_value" integer NOT NULL,
	"undervaluation_pct" real NOT NULL,
	"investment_score" integer NOT NULL,
	"arv" integer,
	"renovation_cost" integer,
	"total_cost" integer,
	"net_profit" integer,
	"roi" real,
	"annualized_roi" real,
	"cash_on_cash" real,
	"break_even_price" integer,
	"recommendation" text,
	"ai_report" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "property_analysis_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "deal_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"amount" integer NOT NULL,
	"date" timestamp NOT NULL,
	"receipt_url" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"purchase_price" integer NOT NULL,
	"purchase_date" timestamp NOT NULL,
	"renovation_budget" integer,
	"renovation_actual" integer,
	"renovation_items" text DEFAULT '[]',
	"sell_price" integer,
	"sell_date" timestamp,
	"status" text DEFAULT 'purchased' NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "deals_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"contact_id" text,
	"called_at" timestamp NOT NULL,
	"duration" integer,
	"outcome" text,
	"notes" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"scheduled_at" timestamp,
	"priority" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"type" text DEFAULT 'agent',
	"tags" text DEFAULT '[]',
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"contact_id" text,
	"stage" text DEFAULT 'new' NOT NULL,
	"priority" integer DEFAULT 0,
	"notes" text,
	"assigned_to" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_data" (
	"id" text PRIMARY KEY NOT NULL,
	"locality" text NOT NULL,
	"date" timestamp NOT NULL,
	"avg_price_sqm" real,
	"listings_count" integer,
	"avg_days_on_market" real,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"price" integer NOT NULL,
	"recorded_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"portal_id" text NOT NULL,
	"portal_name" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"price" integer NOT NULL,
	"price_per_sqm" real,
	"area" real,
	"rooms" text,
	"floor" integer,
	"condition" text,
	"year_built" integer,
	"address" text,
	"lat" real,
	"lng" real,
	"contact_phone" text,
	"contact_name" text,
	"contact_email" text,
	"description" text,
	"image_urls" text DEFAULT '[]',
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen" timestamp NOT NULL,
	"last_seen" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "properties_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "scraping_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"portal" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"listings_found" integer DEFAULT 0,
	"errors" text DEFAULT '[]',
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"scraped_listings" integer DEFAULT 0,
	"scraping_limit" integer DEFAULT 500,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_localities" jsonb DEFAULT '[]'::jsonb,
	"budget_min" integer,
	"budget_max" integer,
	"min_roi" integer DEFAULT 15,
	"min_score" integer DEFAULT 40,
	"property_types" jsonb DEFAULT '[]'::jsonb,
	"renovation_cost_per_sqm" jsonb DEFAULT '{"light":8000,"medium":12000,"full":18000}'::jsonb,
	"agent_commission" integer DEFAULT 4,
	"tax_rate" integer DEFAULT 4,
	"legal_fees" integer DEFAULT 4,
	"contingency_buffer" integer DEFAULT 10,
	"daily_call_limit" integer DEFAULT 15,
	"call_start_hour" integer DEFAULT 9,
	"call_end_hour" integer DEFAULT 18,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"password_hash" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"onboarding_completed" boolean DEFAULT false,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_analysis" ADD CONSTRAINT "property_analysis_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_expenses" ADD CONSTRAINT "deal_expenses_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;