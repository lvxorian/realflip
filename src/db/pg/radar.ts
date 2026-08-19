import { pgTable, text, real, bigint, primaryKey } from "drizzle-orm/pg-core";

export const radarSeries = pgTable(
  "radar_series",
  {
    indicator: text("indicator").notNull(),
    regionKey: text("region_key").notNull(),
    regionType: text("region_type").notNull(),
    period: text("period").notNull(),
    value: real("value").notNull(),
    meta: text("meta"),
    fetchedAt: bigint("fetched_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.indicator, t.regionKey, t.period] })]
);

export const radarReports = pgTable(
  "radar_reports",
  {
    regionKey: text("region_key").notNull(),
    range: text("range").notNull(),
    content: text("content").notNull(),
    generatedAt: bigint("generated_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.regionKey, t.range] })]
);