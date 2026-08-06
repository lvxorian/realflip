import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { investors } from "./investors";
import { leads } from "./leads";

export const investorOfferEmails = sqliteTable(
  "investor_offer_emails",
  {
    id: text("id").primaryKey(),
    investorId: text("investor_id")
      .notNull()
      .references(() => investors.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sentAt: integer("sent_at").notNull(),
  },
  (table) => [uniqueIndex("investor_offer_emails_unique").on(table.investorId, table.leadId)]
);
