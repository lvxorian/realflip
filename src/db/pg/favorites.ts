import { pgTable, text, bigint, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";
import { properties } from "./properties";

export const favorites = pgTable("favorites", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.propertyId] }),
}));
