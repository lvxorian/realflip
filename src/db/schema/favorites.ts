import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { properties } from "./properties";

export const favorites = sqliteTable("favorites", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.propertyId] }),
}));
