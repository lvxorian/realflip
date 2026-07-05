import { pgTable, text, integer, real, timestamp } from "drizzle-orm/pg-core";

export const marketData = pgTable("market_data", {
  id: text("id").primaryKey(),
  locality: text("locality").notNull(),
  date: timestamp("date").notNull(),
  avgPriceSqm: real("avg_price_sqm"),
  listingsCount: integer("listings_count"),
  avgDaysOnMarket: real("avg_days_on_market"),
  createdAt: timestamp("created_at").notNull(),
});

export const scrapingJobs = pgTable("scraping_jobs", {
  id: text("id").primaryKey(),
  portal: text("portal").notNull(),
  status: text("status").default("pending").notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  listingsFound: integer("listings_found").default(0),
  errors: text("errors").default("[]"),
  createdAt: timestamp("created_at").notNull(),
});
