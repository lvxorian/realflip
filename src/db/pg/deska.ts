import { pgTable, text, bigint, integer, real, jsonb } from "drizzle-orm/pg-core";

export const deskaDocuments = pgTable("deska_documents", {
  id: text("id").primaryKey(),
  edeskyId: text("edesky_id").notNull().unique(),
  name: text("name").notNull(),
  dashboardName: text("dashboard_name"),
  dashboardId: text("dashboard_id"),
  category: text("category").default("JINE").notNull(),
  keywordsMatched: text("keywords_matched"),
  origUrl: text("orig_url"),
  edeskyUrl: text("edesky_url"),
  textContent: text("text_content"),
  createdAtDeska: text("created_at_deska"),
  scrapedAt: bigint("scraped_at", { mode: "number" }).notNull(),
  relevance: text("relevance").default("LOW").notNull(),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  propertyId: text("property_id"),
  leadId: text("lead_id"),
  notes: text("notes"),
  isRead: integer("is_read").default(0).notNull(),
  isArchived: integer("is_archived").default(0).notNull(),
  rawData: jsonb("raw_data").default("{}"),
});

export const deskaWatches = pgTable("deska_watches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  keywords: jsonb("keywords").notNull().default("[]"),
  category: text("category"),
  dashboardIds: jsonb("dashboard_ids").default("[]"),
  region: text("region"),
  isActive: integer("is_active").default(1).notNull(),
  lastCheckedAt: bigint("last_checked_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
