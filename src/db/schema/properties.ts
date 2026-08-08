import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  portalId: text("portal_id").notNull(),
  portalName: text("portal_name").notNull(),
  url: text("url").unique().notNull(),
  title: text("title").notNull(),
  price: integer("price").notNull(),
  pricePerSqm: real("price_per_sqm"),
  area: real("area"),
  rooms: text("rooms"),
  floor: integer("floor"),
  condition: text("condition"),
  buildingType: text("building_type"),
  yearBuilt: integer("year_built"),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  contactPhone: text("contact_phone"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  description: text("description"),
  imageUrls: text("image_urls").default("[]"),
  status: text("status").default("active").notNull(),
  removedAt: integer("removed_at"),
  firstSeen: integer("first_seen").notNull(),
  lastSeen: integer("last_seen").notNull(),
  isActive: integer("is_active").default(1),
  areaLocked: integer("area_locked").default(0),
  floorArea: real("floor_area"),
  usableArea: real("usable_area"),
  accessoryArea: real("accessory_area"),
  areaFlag: text("area_flag"),
  auctionDataJson: text("auction_data_json"),
});

export const priceHistory = sqliteTable("price_history", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  price: integer("price").notNull(),
  recordedAt: integer("recorded_at").notNull(),
});

/**
 * Vlastní historie realizovaných prodejů — párování inzerátů.
 * Když inzerát zmizí z portálu (sweep potvrdí odstranění po grace periodě),
 * uložíme jeho finální cenu jako realizovaný prodej a používáme ho jako komparaci.
 */
export const realizedSales = sqliteTable("realized_sales", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  url: text("url"),
  portalName: text("portal_name"),
  title: text("title"),
  /** Finální (poslední známá) cena inzerátu před zmizením. */
  price: integer("price").notNull(),
  pricePerSqm: real("price_per_sqm"),
  area: real("area"),
  rooms: text("rooms"),
  condition: text("condition"),
  buildingType: text("building_type"),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  /** Kdy inzerát zmizel (potvrzené odstranění) — proxy data prodeje. */
  soldAt: integer("sold_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
