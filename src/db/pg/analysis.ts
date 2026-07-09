import { pgTable, text, integer, real, bigint } from "drizzle-orm/pg-core";
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

  // Nová pole z enhanced analyzer
  pricePerSqm: integer("price_per_sqm"),
  marketPriceMin: integer("market_price_min"),
  marketPriceMax: integer("market_price_max"),
  overpricingPct: real("overpricing_pct"),
  locationCategory: text("location_category"),
  locationCity: text("location_city"),
  locationDistrict: text("location_district"),
  segmentRating: text("segment_rating"),
  occupancy: text("occupancy"),
  buildingType: text("building_type"),
  energyLabel: text("energy_label"),
  technicalScore: integer("technical_score"),
  verdictLevel: text("verdict_level"),
  verdictSummary: text("verdict_summary"),
  redFlagsJson: text("red_flags_json"),
  costsJson: text("costs_json"),
  alternativeStrategiesJson: text("alternative_strategies_json"),
  rentalYield: real("rental_yield"),

  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
