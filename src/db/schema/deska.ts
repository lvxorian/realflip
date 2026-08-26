import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const deskaDocuments = sqliteTable("deska_documents", {
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
  scrapedAt: integer("scraped_at").notNull(),
  relevance: text("relevance").default("LOW").notNull(),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  propertyId: text("property_id"),
  leadId: text("lead_id"),
  notes: text("notes"),
  isRead: integer("is_read").default(0).notNull(),
  isArchived: integer("is_archived").default(0).notNull(),
  rawData: text("raw_data").default("{}"),
});

export const deskaWatches = sqliteTable("deska_watches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  keywords: text("keywords").notNull().default("[]"),
  category: text("category"),
  dashboardIds: text("dashboard_ids").default("[]"),
  region: text("region"),
  isActive: integer("is_active").default(1).notNull(),
  lastCheckedAt: integer("last_checked_at"),
  createdAt: integer("created_at").notNull(),
});
