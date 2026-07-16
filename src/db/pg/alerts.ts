import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";
import { users } from "./users";

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  conditions: text("conditions"),
  rules: text("rules").default("{}"),
  channels: text("channels").default('["in_app"]'),
  isActive: integer("is_active").default(1),
  lastTriggered: bigint("last_triggered", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").default("info"),
  read: integer("read").default(0),
  data: text("data"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
