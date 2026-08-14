-- Portal rezervace: model spoluprace + casy drzeni (SQLite)
-- portal_waitlist byla zrusena (07/2026) — tabulka se pri migraci dedupe dle toho, jestli uz existuje sloupec portal_reserved_model.

ALTER TABLE leads
  ADD COLUMN portal_reserved_model text,
  ADD COLUMN portal_reserved_at integer,
  ADD COLUMN portal_expires_at integer;

ALTER TABLE investors
  ADD COLUMN preferred_model text;

DROP TABLE IF EXISTS portal_waitlist;