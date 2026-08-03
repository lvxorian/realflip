-- Investors database + deal → investor (self-funded = NULL)
CREATE TABLE IF NOT EXISTS "investors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"phone" text,
	"email" text,
	"budget" integer,
	"budget_unlimited" integer DEFAULT 0,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "investor_id" text;
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE set null ON UPDATE no action;
