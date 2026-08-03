import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";

export const investors = pgTable("investors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  budget: integer("budget"),
  budgetUnlimited: integer("budget_unlimited").default(0),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
