import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { properties } from "./properties";

/**
 * Konfigurace + poslední stav syncu Realingo (single-user, jeden řádek).
 * Kredenciály se berou z env proměnných (REALINGO_EMAIL / REALINGO_PASSWORD),
 * podobně jako ostatní API klíče — neukládají se do DB.
 */
export const realingoAccount = sqliteTable("realingo_account", {
  id: text("id").primaryKey(),
  enabled: integer("enabled").default(0).notNull(),
  address: text("address").default("Praha").notNull(),
  purpose: text("purpose").default("SELL").notNull(),
  property: text("property").default("FLAT").notNull(),
  buildingStatuses: text("building_statuses").default("[]").notNull(),
  sort: text("sort").default("NEWEST").notNull(),
  first: integer("first").default(40).notNull(),
  maxAge: integer("max_age"),
  lastSyncAt: integer("last_sync_at"),
  lastTotal: integer("last_total").default(0).notNull(),
  lastLocked: integer("last_locked").default(0).notNull(),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

export const realingoScans = sqliteTable("realingo_scans", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  offerId: text("offer_id"),
  scanId: text("scan_id").notNull(),
  status: text("status"),
  resultJson: text("result_json"),
  priceIndexJson: text("price_index_json"),
  comparablesJson: text("comparables_json"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
