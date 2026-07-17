import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { properties } from "./properties";
import { users } from "./users";

export const calculatorPresets = sqliteTable("calculator_presets", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  arv: integer("arv"),
  renovationCost: integer("renovation_cost"),
  targetRoi: integer("target_roi").default(15),
  config: text("config").default("{}"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
