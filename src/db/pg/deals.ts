import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  purchasePrice: integer("purchase_price").notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  renovationBudget: integer("renovation_budget"),
  renovationActual: integer("renovation_actual"),
  renovationItems: text("renovation_items").default("[]"),
  sellPrice: integer("sell_price"),
  sellDate: timestamp("sell_date"),
  status: text("status").default("purchased").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const dealExpenses = pgTable("deal_expenses", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(),
  date: timestamp("date").notNull(),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").notNull(),
});
