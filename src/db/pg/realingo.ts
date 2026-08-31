import { pgTable, text, integer, jsonb, bigint } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const realingoAccount = pgTable("realingo_account", {
  id: text("id").primaryKey(),
  enabled: integer("enabled").default(0).notNull(),
  address: text("address").default("Praha").notNull(),
  purpose: text("purpose").default("SELL").notNull(),
  property: text("property").default("FLAT").notNull(),
  buildingStatuses: jsonb("building_statuses").default([]).notNull(),
  sort: text("sort").default("NEWEST").notNull(),
  first: integer("first").default(40).notNull(),
  maxAge: integer("max_age"),
  lastSyncAt: bigint("last_sync_at", { mode: "number" }),
  lastTotal: integer("last_total").default(0).notNull(),
  lastLocked: integer("last_locked").default(0).notNull(),
  lastError: text("last_error"),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const realingoScans = pgTable("realingo_scans", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  offerId: text("offer_id"),
  scanId: text("scan_id").notNull(),
  status: text("status"),
  resultJson: jsonb("result_json"),
  priceIndexJson: jsonb("price_index_json"),
  comparablesJson: jsonb("comparables_json"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
