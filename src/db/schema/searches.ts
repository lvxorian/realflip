import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { properties } from "./properties";

export const searches = sqliteTable("searches", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: text("filters").notNull(),
  schedule: text("schedule").default("manual").notNull(),
  lastRunAt: integer("last_run_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const searchProperties = sqliteTable("search_properties", {
  searchId: text("search_id")
    .notNull()
    .references(() => searches.id, { onDelete: "cascade" }),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  firstSeen: integer("first_seen").notNull(),
  lastSeen: integer("last_seen").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.searchId, t.propertyId] }),
}));
