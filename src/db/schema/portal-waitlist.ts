import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { leads } from "./leads";
import { investors } from "./investors";

export const portalWaitlist = sqliteTable(
  "portal_waitlist",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    investorId: text("investor_id")
      .notNull()
      .references(() => investors.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("portal_waitlist_unique").on(table.leadId, table.investorId)]
);
