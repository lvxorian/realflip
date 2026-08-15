import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";

export const portalConfig = pgTable("portal_config", {
  id: text("id").primaryKey(),
  fiftyFiftyEnabled: integer("fifty_fifty_enabled").default(1),
  fiftyFiftyNotice: text("fifty_fifty_notice").default(""),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});