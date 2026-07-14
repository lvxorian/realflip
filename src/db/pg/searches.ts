import { pgTable, text, integer, bigint, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";
import { properties } from "./properties";

export const searches = pgTable("searches", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: text("filters").notNull(),
  schedule: text("schedule").default("manual").notNull(),
  lastRunAt: bigint("last_run_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const searchProperties = pgTable("search_properties", {
  searchId: text("search_id")
    .notNull()
    .references(() => searches.id, { onDelete: "cascade" }),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  firstSeen: bigint("first_seen", { mode: "number" }).notNull(),
  lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.searchId, t.propertyId] }),
}));
