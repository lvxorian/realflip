import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { users } from "./users";

export const calculatorPresets = pgTable("calculator_presets", {
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
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
