import { pgTable, text, integer, real, bigint } from "drizzle-orm/pg-core";

export const marketData = pgTable("market_data", {
  id: text("id").primaryKey(),
  locality: text("locality").notNull(),
  date: bigint("date", { mode: "number" }).notNull(),
  avgPriceSqm: real("avg_price_sqm"),
  listingsCount: integer("listings_count"),
  avgDaysOnMarket: real("avg_days_on_market"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

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
