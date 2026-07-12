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
  firstSeen: integer("first_seen", { mode: "timestamp" }).notNull(),
  lastSeen: integer("last_seen", { mode: "timestamp" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const priceHistory = sqliteTable("price_history", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  price: integer("price").notNull(),
  recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
});
