-- Portal rezervace: model spoluprace, casy drzeni + poradnik (SQLite)
ALTER TABLE leads
  ADD COLUMN portal_reserved_model text,
  ADD COLUMN portal_reserved_at integer,
  ADD COLUMN portal_expires_at integer;

ALTER TABLE investors
  ADD COLUMN preferred_model text;

CREATE TABLE IF NOT EXISTS portal_waitlist (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE cascade,
  investor_id text NOT NULL REFERENCES investors(id) ON DELETE cascade,
  created_at integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_waitlist_unique ON portal_waitlist (lead_id, investor_id);
