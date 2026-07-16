import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { properties } from "./properties";

export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  type: text("type").notNull(),
  message: text("message").notNull(),
  propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
  data: text("data"),
  createdAt: integer("created_at").notNull(),
});
