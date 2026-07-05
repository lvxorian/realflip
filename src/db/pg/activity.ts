import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const activityLog = pgTable("activity_log", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  type: text("type").notNull(),
  message: text("message").notNull(),
  propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
  data: text("data"),
  createdAt: timestamp("created_at").notNull(),
});
