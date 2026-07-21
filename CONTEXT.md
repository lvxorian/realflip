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
- **Testing**: Vitest v4 + jsdom + @testing-library/react

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
- Sell commission: 5% (configurable), buyer commission removed (seller pays in CZ)
- **VAT rule**: Pure flip (FO → FO) = sale VAT-exempt without deduction right (§51 ZDPH). Input VAT on renovation CANNOT be claimed. `isVatPayer` toggle removed entirely.
- **Phone formatting**: `formatPhone()` → `+420 608 033 397`
- **Dead deps removed**: `lucide-react` (29 MB), `react-leaflet` — zero imports

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
- **Alerts**: presets → real DB, toggle/delete/edit, `rules` JSON column, AlertMatcher service
- **Contacts**: API route, search, contact detail page with property/lead table
- **Leads/Pipeline**: kanban with real DB, drag & drop, "Převést na deal"
- **Call Mode**: real leads queue from DB, outcomes update lead stage
- **Settings**: auth + session data, calculator preferences

### Phase 4 — Deal/Pipeline Flow (Done)
- "Zahájit jednání" button, creates lead + contact from property
- Pipeline stages: new → contacted → meeting → offer → negotiation → closed → deal
- Portfolio: delete deal with confirmation
- `userId` column added to `leads` table

### Phase 5 — PDF Report & Analyzer (Done)
- `/report/[id]` — standalone A4 printable report
- "Uložit do databáze" + "Uložit a zahájit jednání"
- `POST /api/properties/create-from-url` with duplicate detection

### Phase 6 — Scraper Audit & Polishing (Done)
- **P0.1-P0.7**: cron bypass, UPDATE all fields, AI re-analysis on price change, stale deactivation, parallel enrichment (concurrency=3), maxPages 25→5, contact extraction on all adapters, UTF-8 fix, schedule interval check, search filters in URL params, bazos pagination (5 pages).
- **VAT toggle removed**: `isVatPayer` from `FlipCostConfig`, `vatDeduction` from `DetailedCosts`, checkbox + table row from UI.
- **Tests**: Vitest installed, 126 unit tests across 4 files (`flip-costs`, `utils`, `condition`, `location`). `npm test` passes.
- **Performance**: Dead deps removed. All `<img>` → `loading="lazy"` + `decoding="async"`. Dashboard stats rewritten: 6 sequential → parallel `Promise.all` with column selects + `count()`. Parallelized property initiate + deals + contacts routes.
- **idnes-reality adapter**: Cheerio-based scraping for `reality.idnes.cz`. Registered in both trigger routes. **Image fix**: chyběl `filterImages()` v search i enrich, chybělo `enrichListing()` v `crawlListings()` (ukládaly se jen thumbnaily z vyhledávání). Opraveno.
- **Design polish**: `loading.tsx` pro 4 async server routes. Empty state market page. Cleanup unused imports.

### Phase 7 — Image Pipeline Fixes (Done)
- **idnes-reality**: přidán `filterImages()` do search (ř. 106) i enrich (ř. 190). Přidáno `enrichListing()` do `crawlListings()` — předtím se nevolalo, properties měly jen 1 thumbnail → **rozmazané fotky**.
- **idnes-reality**: přidáno do `PORTAL_BASE_URLS` v `types.ts` — root-relativní URL se správně resolvují.
- **idnes-reality**: absolutní URL detailu z href (byly relativní, enrichment padal).
- **url-scraper.ts**: implementován `scrapeIdnesReality()` — nahrazuje `makeNotImplementedScraper`.
- **orchestrator.ts**: `imageUrls` se při updatu nepřepisují, když nový listing má míň fotek než stávající — **prevence ztráty kvalitních fotek při selhání enrichmentu**.
- **Testy**: 10 unit testů pro `filterImages()` (placeholdery, base URL, root-relative, atd.). Celkem 136 testů.
- **Statistika v Neon**: idnes-reality má 25 properties, všechny s fotkama (díky orchestrator bezpečnostní síti).

## Remaining
- `checkScoreThresholdAlert` not yet called in orchestrator
- Broader dedup/cache persistence (Redis or DB-based)
- url-scraper routing for idnes-reality URLs (currently handled by orchestrator only)

## Key Files

### Core
- `src/db/index.ts` — DB connection
- `src/db/schema/*.ts` — SQLite + `src/db/pg/*.ts` — PG
- `src/lib/auth.ts` — NextAuth config
- `src/lib/utils.ts` — helpers

### Scraping
- `src/lib/scraping/orchestrator.ts` — main orchestrator
- `src/lib/scraping/url-scraper.ts` — single URL scraper
- `src/lib/scraping/adapters/idnes-reality.ts` — newest adapter
- `src/lib/alert-matcher.ts` — Alert rule matching

### Analysis
- `src/lib/analysis/flip-costs.ts` — flip calculator (no VAT)
- `src/lib/analysis/types.ts` — types (no VAT fields)
- `src/components/calculator/interactive-analysis.tsx` — main analysis card
- `src/components/report/property-report.tsx` — PDF report (no VAT row)

### API
- `src/app/api/scraping/trigger/route.ts` — cron trigger, registers all 10 adapters
- `src/app/api/searches/[id]/run/route.ts` — dynamic search run, all 10 adapters
- `src/app/api/dashboard/stats/route.ts` — parallel queries
- `src/app/api/properties/[id]/initiate/route.ts` — parallelized

### Pages
- `src/app/(dashboard)/properties/[id]/page.tsx` — property detail w/ price history
- `src/app/(dashboard)/market/page.tsx` — market overview w/ empty state
- `src/app/(dashboard)/contacts/[id]/page.tsx` — contact detail
- `src/app/(dashboard)/portfolio/page.tsx` — portfolio overview
- `src/app/(dashboard)/portfolio/[id]/page.tsx` — portfolio detail

### Tests
- `vitest.config.ts` — Vitest configuration
- `src/lib/__tests__/flip-costs.test.ts` — 57 tests
- `src/lib/__tests__/utils.test.ts`
- `src/lib/__tests__/condition.test.ts`
- `src/lib/__tests__/location.test.ts`
