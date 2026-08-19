import { sqliteTable, text, real, integer, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * Radar — časové řady tržních indikátorů.
 * Jeden normalizovaný store pro externí (ČNB, ČBA, ČSÚ, cenová mapa) i vlastní
 * (denní snapshoty z DB) série. Klíč: (indicator, regionKey, period).
 *
 * indicator: repo_rate | cba_mortgage_rate | cba_mortgage_volume | cpi_yoy |
 *            real_wage_yoy | avg_wage | started_flats | pop_growth |
 *            market_volume | market_median_price_sqm | market_avg_days |
 *            market_price_drops | market_new_listings | market_removed_listings |
 *            market_gross_yield | realized_avg_price_sqm | offer_avg_price_sqm
 * regionKey: "cr" | kraj klíč (praha, stredocesky, …) | cityKey
 * regionType: "cr" | "kraj" | "city"
 * period: "YYYY-MM"
 */
export const radarSeries = sqliteTable(
  "radar_series",
  {
    indicator: text("indicator").notNull(),
    regionKey: text("region_key").notNull(),
    regionType: text("region_type").notNull(),
    period: text("period").notNull(),
    value: real("value").notNull(),
    meta: text("meta"),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.indicator, t.regionKey, t.period] })]
);

/** Radar — cache AI tržních reportů (region × rozsah). */
export const radarReports = sqliteTable(
  "radar_reports",
  {
    regionKey: text("region_key").notNull(),
    range: text("range").notNull(),
    content: text("content").notNull(),
    generatedAt: integer("generated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.regionKey, t.range] })]
);