import { pgTable, text, bigint, jsonb } from "drizzle-orm/pg-core";

export const offMarketLeads = pgTable("off_market_leads", {
  id: text("id").primaryKey(),
  debtorName: text("debtor_name").notNull(),
  caseNumber: text("case_number").notNull().unique(),
  address: text("address"),
  region: text("region"),
  status: text("status").default("NEW").notNull(),
  rawData: jsonb("raw_data").default("{}"),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
