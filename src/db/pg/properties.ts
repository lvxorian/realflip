import { pgTable, text, integer, real, bigint } from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
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
  removedAt: bigint("removed_at", { mode: "number" }),
  firstSeen: bigint("first_seen", { mode: "number" }).notNull(),
  lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
  isActive: integer("is_active").default(1),
  areaLocked: integer("area_locked").default(0),
  floorArea: real("floor_area"),
  usableArea: real("usable_area"),
  accessoryArea: real("accessory_area"),
  areaFlag: text("area_flag"),
  auctionDataJson: text("auction_data_json"),
});

export const priceHistory = pgTable("price_history", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  price: integer("price").notNull(),
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull(),
});

/** Vlastní historie realizovaných prodejů (párování zmizelých inzerátů). */
export const realizedSales = pgTable("realized_sales", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  url: text("url"),
  portalName: text("portal_name"),
  title: text("title"),
  price: integer("price").notNull(),
  pricePerSqm: real("price_per_sqm"),
  area: real("area"),
  rooms: text("rooms"),
  condition: text("condition"),
  buildingType: text("building_type"),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  soldAt: bigint("sold_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
