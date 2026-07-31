CREATE TABLE IF NOT EXISTS "market_cache" (
	"city" text NOT NULL,
	"segment" text DEFAULT 'any' NOT NULL,
	"low" integer NOT NULL,
	"high" integer NOT NULL,
	"median" integer NOT NULL,
	"sample_size" integer NOT NULL,
	"source" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	"payload" text,
	CONSTRAINT "market_cache_city_segment_pk" PRIMARY KEY ("city","segment")
);
