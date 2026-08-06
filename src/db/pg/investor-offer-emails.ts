import { pgTable, text, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { investors } from "./investors";
import { leads } from "./leads";

export const investorOfferEmails = pgTable(
  "investor_offer_emails",
  {
    id: text("id").primaryKey(),
    investorId: text("investor_id")
      .notNull()
      .references(() => investors.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sentAt: bigint("sent_at", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("investor_offer_emails_unique").on(table.investorId, table.leadId)]
);
