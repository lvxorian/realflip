import { pgTable, text, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { leads } from "./leads";
import { investors } from "./investors";

export const portalWaitlist = pgTable(
  "portal_waitlist",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    investorId: text("investor_id")
      .notNull()
      .references(() => investors.id, { onDelete: "cascade" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("portal_waitlist_unique").on(table.leadId, table.investorId)]
);
