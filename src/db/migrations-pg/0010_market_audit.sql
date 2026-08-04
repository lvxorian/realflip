-- Market data audit: ARV high (per sqm, renovated segment) + source/sample size of market range
ALTER TABLE "property_analysis" ADD COLUMN "arv_price_per_sqm_high" integer;
--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "market_source" text;
--> statement-breakpoint
ALTER TABLE "property_analysis" ADD COLUMN "market_sample_size" integer;