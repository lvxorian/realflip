import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  purchasePrice: integer("purchase_price").notNull(),
  purchaseDate: bigint("purchase_date", { mode: "number" }).notNull(),
  renovationBudget: integer("renovation_budget"),
  renovationActual: integer("renovation_actual"),
  renovationItems: text("renovation_items").default("[]"),
  sellPrice: integer("sell_price"),
  sellDate: bigint("sell_date", { mode: "number" }),
  status: text("status").default("purchased").notNull(),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const dealExpenses = pgTable("deal_expenses", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(),
  date: bigint("date", { mode: "number" }).notNull(),
  receiptUrl: text("receipt_url"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
