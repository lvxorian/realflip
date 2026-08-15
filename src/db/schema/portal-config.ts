import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const portalConfig = sqliteTable("portal_config", {
  id: text("id").primaryKey(),
  fiftyFiftyEnabled: integer("fifty_fifty_enabled").default(1),
  fiftyFiftyNotice: text("fifty_fifty_notice").default(""),
  updatedAt: integer("updated_at").notNull(),
});