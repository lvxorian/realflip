import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";

/**
 * Progress hromadného hledání — která stránka/dávka už byla pro (portál, město)
 * dokončena. Auto-pokračování po limitu 60 s tak navazuje místo restartu od nuly.
 * Řádek se maže po dokončení celého portálu.
 */
export const crawlProgress = pgTable("crawl_progress", {
  id: text("id").primaryKey(), // `${portal}:${city}` — city "" pro celou ČR
  portal: text("portal").notNull(),
  city: text("city").notNull().default(""),
  step: integer("step").notNull().default(0),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});