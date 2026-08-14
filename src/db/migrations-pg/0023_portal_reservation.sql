-- Portal rezervace: model spoluprace + casy drzeni
-- Aplikovat na Neon RUCNE pres direct (non-pooler) pripojeni, viz CLAUDE.md.
-- portal_waitlist zrusena (07/2026) — DROP je bezpecny idempotentni.

ALTER TABLE leads
  ADD COLUMN portal_reserved_model text,
  ADD COLUMN portal_reserved_at bigint,
  ADD COLUMN portal_expires_at bigint;

ALTER TABLE investors
  ADD COLUMN preferred_model text;

DROP TABLE IF EXISTS portal_waitlist;