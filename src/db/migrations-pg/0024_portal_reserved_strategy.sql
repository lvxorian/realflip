-- Portal rezervace: chybejici sloupec portal_reserved_strategy
-- (na Neonu chybel, viz 0013/0023 ktere ho nepridavaly; 0009 na Neonu nikdy neprobehl).
-- Aplikovat na Neon RUCNE pres direct (non-pooler) pripojeni, viz CLAUDE.md.
-- Idempotentni — bezpecne i na jiz migrovanem schema. Provedeno 08/2026.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS portal_reserved_strategy text;