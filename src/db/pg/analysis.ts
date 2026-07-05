import { pgTable, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const propertyAnalysis = pgTable("property_analysis", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  marketValue: integer("market_value").notNull(),
  undervaluationPct: real("undervaluation_pct").notNull(),
  investmentScore: integer("investment_score").notNull(),
  arv: integer("arv"),
  renovationCost: integer("renovation_cost"),
  totalCost: integer("total_cost"),
  netProfit: integer("net_profit"),
  roi: real("roi"),
  annualizedRoi: real("annualized_roi"),
  cashOnCash: real("cash_on_cash"),
  breakEvenPrice: integer("break_even_price"),
  recommendation: text("recommendation"),
  aiReport: text("ai_report"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
