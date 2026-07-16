import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const marketData = sqliteTable("market_data", {
  id: text("id").primaryKey(),
  locality: text("locality").notNull(),
  date: integer("date").notNull(),
  avgPriceSqm: real("avg_price_sqm"),
  listingsCount: integer("listings_count"),
  avgDaysOnMarket: real("avg_days_on_market"),
  createdAt: integer("created_at").notNull(),
});

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
