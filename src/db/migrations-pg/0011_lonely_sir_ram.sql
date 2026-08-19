CREATE TABLE "radar_reports" (
	"region_key" text NOT NULL,
	"range" text NOT NULL,
	"content" text NOT NULL,
	"generated_at" bigint NOT NULL,
	CONSTRAINT "radar_reports_region_key_range_pk" PRIMARY KEY("region_key","range")
);
--> statement-breakpoint
CREATE TABLE "radar_series" (
	"indicator" text NOT NULL,
	"region_key" text NOT NULL,
	"region_type" text NOT NULL,
	"period" text NOT NULL,
	"value" real NOT NULL,
	"meta" text,
	"fetched_at" bigint NOT NULL,
	CONSTRAINT "radar_series_indicator_region_key_period_pk" PRIMARY KEY("indicator","region_key","period")
);
