import { pgTable, text, integer, jsonb, bigint } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userPreferences = pgTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  targetLocalities: jsonb("target_localities").default([]),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  minRoi: integer("min_roi").default(15),
  minScore: integer("min_score").default(40),
  propertyTypes: jsonb("property_types").default([]),
  renovationCostPerSqm: jsonb("renovation_cost_per_sqm").default({ light: 8000, medium: 12000, full: 18000 }),
  agentCommission: integer("agent_commission").default(4),
  taxRate: integer("tax_rate").default(4),
  legalFees: integer("legal_fees").default(4),
  contingencyBuffer: integer("contingency_buffer").default(10),
  dailyCallLimit: integer("daily_call_limit").default(15),
  callStartHour: integer("call_start_hour").default(9),
  callEndHour: integer("call_end_hour").default(18),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").default("free").notNull(),
  status: text("status").default("active").notNull(),
  scrapedListings: integer("scraped_listings").default(0),
  scrapingLimit: integer("scraping_limit").default(500),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
