CREATE TABLE IF NOT EXISTS "realized_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE cascade,
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
CREATE INDEX IF NOT EXISTS "realized_sales_sold_at_idx" ON "realized_sales" ("sold_at");
