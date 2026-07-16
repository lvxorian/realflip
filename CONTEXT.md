# RealFlip Pro — Context

## Goal
Full-stack SaaS platform for Czech real estate flipping: scraping 10+ portals, AI deal analysis, pipeline/CRM, call mode, portfolio tracking, market intelligence.

## Stack
- **Framework**: Next.js 16.2.10 (App Router), Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion v12.42.2
- **Icons**: @phosphor-icons/react v2.1.10
- **DB**: Neon PostgreSQL (cloud) / SQLite (local) via Drizzle ORM
- **Auth**: NextAuth v5 (credentials + Google OAuth, JWT strategy)
- **Mapping**: Leaflet + OpenStreetMap

## Infrastructure
- **DB**: Neon PostgreSQL + `data.db` (SQLite fallback)
- **Test account**: `cakmak@tuta.com` / `realflip2026`
- **Deploy**: Vercel + Neon (drizzle-kit push for schema migrations)
- **Cron**: 6:00, 14:00, 22:00 UTC daily via Vercel Cron → `/api/scraping/trigger`

## Key Decisions
- JSON stored as text columns (SQLite compatible)
- Timestamps as epoch ms numbers (aligned SQLite + PG)
- `ts()` helper = `Date.now()` for all DB timestamps
- Condition/buildingType stored as English keys, displayed via `conditionLabel()`/`buildingTypeLabel()` helpers
- Sell commission: 4% (realistic CZ rate)
- Buyer commission: removed (seller pays in CZ)
- EnergyCert: removed, replaced with `sourcingFee` (Provize za zprostředkování)

## Progress

### Phase 1 — Foundation (Done)
- Scraping engine: types, rate-limiter, deduplicator, base adapter, orchestrator, 6 portal adapters
- Analysis engine: flip-calculator, market-data, location, condition detection
- Interactive analysis: flip calculator with toggles, cost breakdown, target price, comps, AI negotiation
- Price validation, image filters, sreality URL format fixes

### Phase 2 — P0/P1 Bugfixes (Done)
- Server Component `onChange` → extracted `<SearchFilter>` client component
- Auth adapter: `$defaultFn(() => crypto.randomUUID())` for accounts/sessions IDs
- `/properties` page crash fixed
- Multi-tenant data leaks: user-scoped queries for stats, notifications
- Error boundaries: global + dashboard
- Timestamp alignment: all columns use epoch ms numbers, `ts()` helper
- `String(error)` leaks replaced with safe messages (9 API routes)
- NaN "dní na trhu" handling, Invalid Date guard in search detail
- Description truncation (500 chars) removed from API + component

### Phase 3 — Mock Pages → Real Data (Done)
- **Alerts**: presets → real DB, toggle/delete/edit, `rules` JSON column, AlertMatcher service for price drop notifications
- **Contacts**: API route, search, contact detail page `/contacts/[id]` with property/lead table
- **Leads/Pipeline**: kanban with real DB, drag & drop updates stage, "Převést na deal" for closed leads
- **Call Mode**: real leads queue from DB, outcomes update lead stage
- **Settings**: auth + session data, calculator preferences

### Phase 4 — Deal/Pipeline Flow (Done)
- "Zahájit jednání" button (replaces "Uložit do portfolia")
- Creates lead + contact from property data
- Pipeline stages: new → contacted → meeting → offer → negotiation → closed → convert to deal
- Lost leads archived (filtered, harmless)
- Portfolio: delete deal with confirmation
- `userId` column added to `leads` table (multi-tenant)

### Phase 5 — PDF Report & Analyzer (Done)
- `/report/[id]` — standalone investment analysis report, printable (A4), BW-safe design
- "Uložit do databáze" and "Uložit a zahájit jednání" buttons in analyzer
- `POST /api/properties/create-from-url` with duplicate detection
- "Již v databázi ✅" message for existing properties

### Phase 6 — Sourcing Fee & Price Drop (Done)
- `energyCert` removed, `sourcingFee` added (Provize za zprostředkování) with Kč/% toggle
- Price drop badge on property detail: `Cena snížena o X % (z Y Kč)`
- `lastRunAt` always updated after every search run
- Cron: 3× daily (6/14/22 UTC)

## Remaining
- Czech labels all converted (buildingType, occupancy, locationCategory, Walk-away price → Max. nabídka)
- Contact duplicated in sidebar fixed (moved up, merged styling)
- AlertMatcher: `score_threshold` rule type implemented but `checkScoreThresholdAlert` not yet called in orchestrator

## Key Files

### Core
- `src/db/index.ts` — DB connection
- `src/db/schema/*.ts` — SQLite + `src/db/pg/*.ts` — PG
- `src/lib/auth.ts` — NextAuth config
- `src/lib/utils.ts` — `ts()`, `formatPrice`, `conditionLabel`, `buildingTypeLabel`, `occupancyLabel`, `locationCategoryLabel`, `safeJsonParse`

### Scraping
- `src/lib/scraping/orchestrator.ts` — main orchestrator, now with AlertMatcher integration
- `src/lib/scraping/url-scraper.ts` — single URL scraper (used by analyzer)
- `src/lib/alert-matcher.ts` — Alert rule matching for price drops

### Analysis
- `src/lib/analysis/flip-costs.ts` — flip calculator with `sourcingFee`
- `src/lib/analysis/types.ts` — `DetailedCosts` now has `sourcingFee`
- `src/components/calculator/interactive-analysis.tsx` — main analysis card UI

### Reports
- `src/components/report/property-report.tsx` — PDF report component
- `src/app/report/[id]/page.tsx` — standalone report page

### Features
- `src/app/(dashboard)/alerts/page.tsx` — alerts with presets
- `src/app/(dashboard)/leads/page.tsx` — pipeline kanban
- `src/app/(dashboard)/contacts/[id]/page.tsx` — contact detail
- `src/app/(dashboard)/call-mode/page.tsx` — call queue
- `src/app/(dashboard)/properties/[id]/page.tsx` — property detail with price drop badge
- `src/app/(dashboard)/searches/[id]/page.tsx` — search detail with run button
