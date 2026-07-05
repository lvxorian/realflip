import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  conditions: text("conditions"),
  channels: text("channels").default('["in_app"]'),
  isActive: boolean("is_active").default(true),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").default("info"),
  read: boolean("read").default(false),
  data: text("data"),
  createdAt: timestamp("created_at").notNull(),
});
