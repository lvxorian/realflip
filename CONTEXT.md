# RealFlip Pro — Context

## Goal
Full-stack SaaS platform for Czech real estate flipping: scraping 10+ portals, AI deal analysis, pipeline/CRM, call mode, portfolio tracking, market intelligence, off-market opportunities.

## Stack
- **Framework**: Next.js 16.2.10 (App Router), Turbopack
- **Language**: TypeScript + Python (scraping scripts)
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion v12.42.2
- **Icons**: @phosphor-icons/react v2.1.10
- **DB**: Neon PostgreSQL (cloud) / SQLite (local) via Drizzle ORM
- **Auth**: NextAuth v5 (credentials + Google OAuth, JWT strategy)
- **Mapping**: Leaflet + OpenStreetMap
- **Testing**: Vitest v4 + jsdom + @testing-library/react (219 tests, 13 files)

## Infrastructure
- **DB**: Neon PostgreSQL + `data.db` (SQLite fallback)
- **Test account**: `cakmak@tuta.com` / `realflip2026`
- **Deploy**: Vercel + Neon (Hobby plan, 1 cron/day)
- **Cron**: 6:00 UTC daily via Vercel Cron → `/api/scraping/trigger`
- **GitHub Actions**: `drazby-hunter.yml` — daily at 6:00 UTC, scrapes Portál dražeb

## Key Decisions
- JSON stored as text columns (SQLite compatible)
- Timestamps as epoch ms numbers (aligned SQLite + PG)
- `ts()` helper = `Date.now()` for all DB timestamps
- Condition/buildingType stored as English keys, displayed via helpers
- Sell commission: 5% (configurable), buyer commission removed
- **VAT**: Pure flip (FO→FO) = VAT-exempt without deduction (§51). `isVatPayer` removed.
- **Tax**: Income tax fixed at 21% (not editable, hardcoded in calc).
- **Phone**: `formatPhone()` → `+420 608 033 397`
- **Dead deps removed**: `lucide-react` (29 MB), `react-leaflet`

## Progress

### Phase 1-6 — Foundation through Scraper Audit (Done)
Scraping engine, analysis, mocks→DB, pipeline, PDF report, scraper fixes, VAT removal, tests, performance, image fixes.

### Phase 7 — Image Pipeline Fixes (Done)
idnes-reality: enrichment, filterImages, PORTAL_BASE_URLS, url-scraper, orchestrator image overwrite protection. Sreality CDN `fl` params for images.

### Phase 8 — Favorites & Tax (Done)
Favorites table, FavoriteButton component, integration in grid/list/detail. Tax rate fixed to 21% (removed from UI).

### Phase 9 — Search/Scheduling Fixes (Done)
- `vercel.json` cron reverted to 1× daily (Hobby limit).
- `crawlSearch()`: parallel portals via `Promise.allSettled`, `lastRunAt` set immediately.
- `crawlAllScheduled()`: try/catch per search (failure isolation).

### Phase 10 — Off-Market Module (Done)
- DB: `vykupy_leads` (standalone, no FK) + `vykupy_regions`.
- API: CRUD endpoints for leads + regions, Bearer token + session auth.
- Data source: Portál dražeb public JSON API (real estate auctions).
- Python script: `scripts/drazby_hunter.py` — fetches auctions → POST to API.
- GitHub Actions: `.github/workflows/drazby-hunter.yml` — daily cron.
- UI: `/vykupy` table with filters (status, region, category), detail page with status management, letter template modal. Region management modal.
- ISIR Hunter removed (ISIR SOAP API not publicly accessible).

### Phase 11 — Scraper Revize (Done)
- `crawlAll`: parallelized with `Promise.allSettled` (was sequential).
- Stale deactivation: bulk `UPDATE ... WHERE NOT IN` (was N+1).
- `saveListing`: passes `listing.portalName` to `filterImages` (was missing).
- Re-analysis: only on price change (was every crawl).
- mmreality: removed `group.name !== "Byty"` filter (was skipping houses/land/commercial).
- hyperinzerce: CSS selectors unified with url-scraper (was using wrong class names).

### Phase 12 — PDF Report Fixes (Done)
- Loads from calc-preset API as fallback (was localStorage only).
- Sourcing fee handling matched with calculator.
- Scoring comparison table ("Původní inzerát" / "Po vyjednání") removed.
- Renovation items table removed.
- Footer removed ("Vygenerováno prostřednictvím...").
- Selective row removal from "Původní inzerát" table.

### Phase 13 — Editable Target Price (Done)
- Click on target price → edit input (number only, "Kč" as separate element).
- ROI slider precision: `step={0.1}` (was 0.5).
- Price ↔ ROI fully connected: changing price recalculates ROI (moves slider), changing slider recalculates price.
- Saved to localStorage + calc-preset API.
- Loaded by PDF report.

### Phase 14 — Market Price Cascade Tier 1-5 (Done)
- `src/lib/scraping/market-price-service.ts` kaskáda: `market_cache` (PG, TTL 24h) → Sreality API (segment, rate-limited) → vlastní DB kompy z `properties` (bez novostaveb, min 5 000 Kč/m²) → `MARKET_DATA` hardcoded → fallback p25–p75.
- `market_cache` tabulka PK `(city, segment)`. Na Neonu vytvořena ručně SQL — DB **nemá** `__drizzle_migrations` (založena přes push), migrace se aplikují ručně.
- `sreality-sitemap.ts` + `SrealityAdapter.crawlCityListings(cityKey)` — city-level vzorky z Sreality.
- ARV počítán z horní hranice rozmezí. Live check: Praha n=487, Brno 95–145k, Most fallback.
- Re-analysis: 83/83 aktivních nemovitostí, 0 chyb.

### Phase 15 — Dražby (Auctions) (Done)
- Refaktor sekce "Off-Market" → "Výkupy" (nav label + Gavel, route `/vykupy`, stará `/off-market` redirectuje).
- **1-Click Due Diligence**: `AuctionAnalyzer` → POST `/api/parse-auction` (URL z portaldrazeb.cz, mock 2s) → vyplní kalkulačku.
- **Kalkulačka přímého výkupu**: OC, NP, AsIs TMV, TD, sleva (30 %), TC (75k), Sourcing Fee (100k), RC, ARV. `TBP = AsIs × (100−sleva)/100`, `NCO = TBP − TD − TC`, zelený/červený verdikt, Zisk (přímý výkup vs. s rekonstrukcí). localStorage autosave.
- **PDF export**: `window.print()` + `@media print` sekce (`#auction-print-area`) — bez zápisu do DB.
- Pipeline kostra `src/lib/auctions/parse-auction.ts` (HTML → PDF → Gemini OCR) — zatím mock, nenapojeno.
- Leads list (Portál dražeb hunter) přesunut pod kalkulačku jako kolapsovatelná sekce.

### Phase 16 — Pipeline CRM Redesign (Done)
- `/leads` přepsán na profesionální kanban: `LeadsBoard` (dnd-kit DndContext + SortableContext + DragOverlay), `LeadCard` (auto-zhuštění container queries), `LeadDrawer` (slide-over, PATCH, převod na deal), `LeadsToolbar` (search/filter/sort).
- Sloupce flex-1 (fit do 1400px), smazáno 6 testovacích leadů.
- Kontakt v pipeline = live z properties (coalesce), dedup kontaktů phone+name.
- Dashboard stats fix: `totalLeads` dle userId, `activeDeals` z deals count (`status != sold`).

### Phase 17 — Editovatelná plocha + Smazání nemovitosti (Done)
- `properties.area_locked` (integer, default 0) — scraper nepřepíše ručně opravenou plochu; `pricePerSqm` se přepočítá.
- `PATCH /api/properties/[id]` — uloží plochu + **re-analyzuje** offline (uložený market range) + vymaže calc-preset.
- `EditableArea` v detailu (tužka → inline input), badge "ručně".
- `DELETE /api/properties/[id]` + `DeletePropertyButton` v sidebaru (cascade přes FK).

### Phase 18 — Lokalitní inteligence (Done)
- Nový modul `src/lib/locality/` + sekce Trh.
- **Reálné zdroje**: ČSÚ nezaměstnanost (2023) + migrace (2024) přes NKOD DCAT; **PČR kriminalita** z XLSX statistik; **sreality POI vzdálenosti** pro walkability (nahradilo nestabilní Overpass); **sreality nájmy** pro rentový výnos; **transport** z poi_metro/train/bus distance.
- **Žádné vymyšlené hodnoty**: renta null bez ≥5 vzorků, kriminalita nikdy statická mapa, POI min 3 vzorky.
- **AI dohled** (`src/lib/ai/locality-guard.ts`): Gemini sanity-check podezřelých dat, verdikt do `propertyAnalysis.aiLocalityVerdict`, badge v UI.
- **Investiční nástroje v Trhu**: `LocalityMarkets`, `PriceIndexCard` (IQR outliery, robust base), `BuyVsRentCalculator`.
- Cenový index a reprodukční cena (orientační, označené).
- Tabulky: `locality_metrics` PK (city_key, source, period), `rents` PK (city_key, segment) + walkability/counts_json; `propertyAnalysis` + locality sloupce.

## Remaining
- `/api/parse-auction` je zatím **mock** — napojit reálnou pipeline (stahování HTML/PDF + LLM extrakce) z `src/lib/auctions/parse-auction.ts`.
- `checkScoreThresholdAlert` not yet called in orchestrator.
- Broader dedup/cache persistence (Redis or DB-based).
- iDnes-reality `yearBuilt` extraction (no "rok" column in most listings).
- DB `target_roi` column is `integer`, should be `real` for decimal precision.
- Neon nemá `__drizzle_migrations` — nové migrace aplikovat ručně SQL (`drizzle-kit push` blokuje interactive prompts).
- Lokalitní data: SLDB 2021 (věk/vzdělání) a ARES firmy zatím nejsou napojené (chybí v `missing` dimenzích) — firmy/sldb vrací null.
- Renta pro malá města (<5 vzorků) = null; doplnit více vzorků přes vícestránkový scrap.
- Kriminalita cache 30 dní (PČR měsíční XLSX) — přidat automatické obnovení dalších měsíců.
- AI guard spouští Gemini jen pro podezřelá data; při 503 (high demand) tichý fallback na null (bez badge).

## Key Files

### Core
- `src/db/index.ts`, `src/db/schema/*.ts`, `src/db/pg/*.ts`
- `src/lib/auth.ts`, `src/lib/utils.ts`

### Scraping
- `src/lib/scraping/orchestrator.ts`
- `src/lib/scraping/url-scraper.ts`
- `src/lib/scraping/types.ts`
- `src/lib/scraping/adapters/` — 7 adapters

### Analysis / Calculator
- `src/lib/analysis/flip-costs.ts`
- `src/lib/analysis/types.ts`
- `src/components/calculator/interactive-analysis.tsx`
- `src/components/report/property-report.tsx`
- `src/components/calculator/property-detail-analysis.tsx`

### Off-Market / Výkupy
- `scripts/drazby_hunter.py`
- `src/app/(dashboard)/vykupy/page.tsx` (Výkupy: analyzer + kalkulačka + leads)
- `src/app/(dashboard)/vykupy/[id]/page.tsx`
- `src/app/api/vykupy/leads/route.ts`
- `src/app/api/vykupy/leads/[id]/route.ts`
- `src/app/api/vykupy/regions/route.ts`
- `src/app/api/parse-auction/route.ts` — 1-Click DD (reálná pipeline)
- `src/components/auctions/auction-analyzer.tsx`
- `src/components/auctions/auction-calculator.tsx`
- `src/lib/auctions/parse-auction.ts` — DD pipeline kostra (HTML → PDF → Gemini)
- `src/components/vykupy/letter-modal.tsx`
- `src/components/vykupy/region-manager-modal.tsx`

### Market Data
- `src/lib/scraping/market-price-service.ts` — kaskáda Tier 1-5
- `src/lib/scraping/sreality-sitemap.ts` — sitemap parser + city sampling
- `src/lib/analysis/market-data.ts` — hardcoded city data (Tier 4)
- `src/lib/market/price-index.ts` — cenový index (IQR, robust base)
- `scripts/reanalyze.ts`, `scripts/live-market-check.ts`, `scripts/check-migration.ts`, `scripts/refresh-locality.ts`

### Lokalitní inteligence
- `src/lib/locality/index.ts` — orchestrátor (getLocalityForProperty, analyzeLocalityAndPersist)
- `src/lib/locality/czso.ts` — ČSÚ nezaměstnanost (2023) + migrace (2024) přes NKOD
- `src/lib/locality/crime.ts` — PČR XLSX kriminalita per kraj
- `src/lib/locality/poi.ts` — sreality POI vzdálenosti → walkability
- `src/lib/locality/rent.ts` + `src/lib/scraping/rent-scraper.ts` — nájmy + hrubý výnos
- `src/lib/locality/transport.ts` — dopravní skóre + prémie
- `src/lib/locality/score.ts` — normalizace dimenzí + vážené skóre (±8 na investmentScore)
- `src/lib/ai/locality-guard.ts` — Gemini sanity-check (AI dohled)
- `src/components/properties/locality-profile.tsx` — UI blok v detailu
- `src/components/market/locality-markets.tsx`, `price-index-card.tsx`, `buy-vs-rent.tsx` — Trh

### Pipeline (Leads)
- `src/components/leads/leads-board.tsx`, `lead-card.tsx`, `lead-drawer.tsx`, `leads-toolbar.tsx`, `types.ts`
- `src/lib/leads.ts` — LEAD_STAGES
- `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts`, `src/app/api/leads/[id]/convert/route.ts`

### API
- `src/app/api/scraping/trigger/route.ts`
- `src/app/api/searches/[id]/run/route.ts`
- `src/app/api/favorites/toggle/route.ts`
- `src/app/api/properties/[id]/calc-preset/route.ts`
- `src/app/api/properties/[id]/route.ts` — GET + PATCH (plocha/re-analýza) + DELETE
- `src/app/api/locality/[cityKey]/route.ts`, `src/app/api/locality/refresh/route.ts`
- `src/app/api/market/price-index/route.ts`

### Tests
- `vitest.config.ts`
- `src/lib/__tests__/flip-costs.test.ts`
- `src/lib/__tests__/utils.test.ts`
- `src/lib/__tests__/condition.test.ts`
- `src/lib/__tests__/location.test.ts`
- `src/lib/__tests__/leads.test.ts`
- `src/lib/__tests__/locality.test.ts` — locality skóre (unemployment, migration, crime, walkability, rent, transport)
- `src/lib/__tests__/replacement-cost.test.ts` — reprodukční cena
- `src/lib/analysis/__tests__/analyzer-arv.test.ts`
- `src/lib/scraping/__tests__/adapters-image.test.ts`
- `src/lib/scraping/__tests__/filters.test.ts`
- `src/lib/scraping/__tests__/market-price-service.test.ts`
