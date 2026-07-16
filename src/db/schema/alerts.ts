import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  conditions: text("conditions"),
  channels: text("channels").default('["in_app"]'),
  isActive: integer("is_active").default(1),
  lastTriggered: integer("last_triggered", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").default("info"),
  read: integer("read", { mode: "boolean" }).default(false),
  data: text("data"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
