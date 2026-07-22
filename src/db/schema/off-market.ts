import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const offMarketLeads = sqliteTable("off_market_leads", {
  id: text("id").primaryKey(),
  debtorName: text("debtor_name").notNull(),
  caseNumber: text("case_number").notNull().unique(),
  address: text("address"),
  region: text("region"),
  status: text("status").default("NEW").notNull(),
  rawData: text("raw_data").default("{}"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const offMarketRegions = sqliteTable("off_market_regions", {
  id: text("id").primaryKey(),
  region: text("region").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});
