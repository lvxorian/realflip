import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const marketData = sqliteTable("market_data", {
  id: text("id").primaryKey(),
  locality: text("locality").notNull(),
  date: integer("date").notNull(),
  avgPriceSqm: real("avg_price_sqm"),
  listingsCount: integer("listings_count"),
  avgDaysOnMarket: real("avg_days_on_market"),
  createdAt: integer("created_at").notNull(),
});

export const marketCache = sqliteTable(
  "market_cache",
  {
    city: text("city").notNull(),
    segment: text("segment").notNull().default("any"),
    low: integer("low").notNull(),
    high: integer("high").notNull(),
    median: integer("median").notNull(),
    sampleSize: integer("sample_size").notNull(),
    source: text("source").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
    payload: text("payload"),
  },
  (t) => [primaryKey({ columns: [t.city, t.segment] })]
);

export const scrapingJobs = sqliteTable("scraping_jobs", {
  id: text("id").primaryKey(),
  portal: text("portal").notNull(),
  status: text("status").default("pending").notNull(),
  startedAt: integer("started_at"),
  finishedAt: integer("finished_at"),
  listingsFound: integer("listings_found").default(0),
  errors: text("errors").default("[]"),
  createdAt: integer("created_at").notNull(),
});

export const localityMetrics = sqliteTable(
  "locality_metrics",
  {
    cityKey: text("city_key").notNull(),
    source: text("source").notNull(),
    period: text("period").notNull(),
    jsonData: text("json_data").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cityKey, t.source, t.period] })]
);

export const poiMetrics = sqliteTable(
  "poi_metrics",
  {
    cityKey: text("city_key").notNull(),
    district: text("district").notNull().default(""),
    countsJson: text("counts_json").notNull(),
    walkability: integer("walkability"),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cityKey, t.district] })]
);

export const rents = sqliteTable(
  "rents",
  {
    cityKey: text("city_key").notNull(),
    segment: text("segment").notNull().default("any"),
    rentPerSqm: real("rent_per_sqm"),
    medianRent: integer("median_rent"),
    walkability: integer("walkability"),
    countsJson: text("counts_json"),
    sampleSize: integer("sample_size").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cityKey, t.segment] })]
);
