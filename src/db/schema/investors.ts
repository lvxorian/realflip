import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const investors = sqliteTable("investors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  budget: integer("budget"),
  budgetUnlimited: integer("budget_unlimited").default(0),
  portalEnabled: integer("portal_enabled").default(0),
  notes: text("notes"),
  lastActiveAt: integer("last_active_at"),
  loginCount: integer("login_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
