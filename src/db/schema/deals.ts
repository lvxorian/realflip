import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { properties } from "./properties";

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  purchasePrice: integer("purchase_price").notNull(),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }).notNull(),
  renovationBudget: integer("renovation_budget"),
  renovationActual: integer("renovation_actual"),
  renovationItems: text("renovation_items").default("[]"),
  sellPrice: integer("sell_price"),
  sellDate: integer("sell_date", { mode: "timestamp" }),
  status: text("status").default("purchased").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const dealExpenses = sqliteTable("deal_expenses", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  receiptUrl: text("receipt_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
