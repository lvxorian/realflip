CREATE TABLE IF NOT EXISTS "investor_offer_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"investor_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"sent_at" bigint NOT NULL,
	CONSTRAINT "investor_offer_emails_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE cascade,
	CONSTRAINT "investor_offer_emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "investor_offer_emails_unique" ON "investor_offer_emails" ("investor_id","lead_id");
