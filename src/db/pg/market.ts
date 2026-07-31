import { pgTable, text, integer, real, bigint, primaryKey } from "drizzle-orm/pg-core";

export const marketData = pgTable("market_data", {
  id: text("id").primaryKey(),
  locality: text("locality").notNull(),
  date: bigint("date", { mode: "number" }).notNull(),
  avgPriceSqm: real("avg_price_sqm"),
  listingsCount: integer("listings_count"),
  avgDaysOnMarket: real("avg_days_on_market"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const marketCache = pgTable(
  "market_cache",
  {
    city: text("city").notNull(),
    segment: text("segment").notNull().default("any"),
    low: integer("low").notNull(),
    high: integer("high").notNull(),
    median: integer("median").notNull(),
    sampleSize: integer("sample_size").notNull(),
    source: text("source").notNull(),
    fetchedAt: bigint("fetched_at", { mode: "number" }).notNull(),
    payload: text("payload"),
  },
  (t) => [primaryKey({ columns: [t.city, t.segment] })]
);

export const scrapingJobs = pgTable("scraping_jobs", {
  id: text("id").primaryKey(),
  portal: text("portal").notNull(),
  status: text("status").default("pending").notNull(),
  startedAt: bigint("started_at", { mode: "number" }),
  finishedAt: bigint("finished_at", { mode: "number" }),
  listingsFound: integer("listings_found").default(0),
  errors: text("errors").default("[]"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
