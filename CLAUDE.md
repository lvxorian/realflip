@AGENTS.md

# RealFlip — Working Context

## Auth
`cakmak@tuta.com` / `realflip2026` — NextAuth v5, JWT, credentials + Google OAuth.

## DB
Neon PostgreSQL (prod) + SQLite `data.db` (local). Drizzle ORM.
**All timestamps = epoch-ms.** Use `ts()` (= `Date.now()`).
PG schema in `src/db/pg/`, SQLite in `src/db/schema/` — both exported from `index.ts`.

## Design
Pure dark UI. Emerald `#10b981` accent, dark bg `#0f0f11`, rounded-2xl cards, Geist font, `@phosphor-icons/react`.
All `<img>`: `referrerPolicy="no-referrer"` + `loading="lazy"` + `decoding="async"` + `onError`.

## Key Rules
- **VAT**: Pure flip (FO→FO) = VAT-exempt without deduction (§51). `isVatPayer` removed.
- **Tax**: Income tax fixed at 21% in calculation (not editable in UI).
- **Sell commission**: 5% default, configurable.
- **Phone**: `formatPhone()` → `+420 608 033 397`.
- **Cron**: 6:00 UTC daily via Vercel Cron (Hobby limit). Bypasses auth via `x-vercel-cron`.

## Test Stack
Vitest v4 + jsdom + @testing-library/react. 174 tests across 9 files.
`npm test` or `npx vitest run`.

## Portals (10 adapters, 6 url-scrapers)
sreality, bazos, reality-cz, hyperinzerce, annonce, mmreality, idnes-reality (+ bezrealitky, remax, century21, hyperreality as not-implemented)

## Image Pipeline
- `filterImages()` + `normalizeImageUrl()` in `types.ts` — central gatekeeper.
- `PORTAL_BASE_URLS` — root-relative → absolute for 7 portals.
- Sreality CDN images require `?fl=res,1200,1200,1|wrm,/watermark/sreality.png,10|shr,,20|webp,80` appended.
- Orchestrator saves with portalName (fix: was missing, root-rel URLs dropped).

## Dražby (Auctions) Module
- Nav label "Dražby" (Gavel), routes zůstávají `/off-market`, `/off-market/[id]`.
- **1-Click Due Diligence** (`AuctionAnalyzer`): input URL z portaldrazeb.cz → POST `/api/parse-auction` (validace `portaldrazeb.cz`, mock 2s delay) → vyplní kalkulačku.
- **Kalkulačka přímého výkupu** (`AuctionCalculator`): OC, NP, AsIs TMV (default OC), TD, sleva (30 %), TC (75k), Sourcing Fee (100k), RC, ARV.
  - `TBP = AsIs_TMV × (100 − sleva)/100`; `NCO = TBP − TD − TC`.
  - NCO > 0 → zelený box „Výkup je realizovatelný…"; NCO ≤ 0 → červený box (haircut s věřiteli).
  - Zisk: RC == 0 → `AsIs_TMV − (TBP + TC + SF)`; RC > 0 → `ARV − (TBP + TC + RC + SF)`.
  - localStorage autosave klíč `auction-calculator:v1` + Reset.
  - PDF: `window.print()` + `@media print` (skryje vše kromě `#auction-print-area`, vzor property-report). Bez zápisu do DB.
- **Pipeline kostra** `src/lib/auctions/parse-auction.ts`: `fetchDetailPage → extractPdfLinks → downloadPdfBuffers → extractWithGemini` (PDF jako `inline_data` base64 — gemini-2.5-flash má nativní OCR, `responseMimeType: application/json`). Zatím NENÍ volána — napojit v route.
- Leads list (Portál dražeb hunter) = kolapsovatelná sekce pod kalkulačkou, API beze změn.
- DB: `off_market_leads`, `off_market_regions` (standalone, no FK). Python `scripts/drazby_hunter.py` denně přes GitHub Actions.

## Market Data Cascade (Tier 1-5)
- `src/lib/scraping/market-price-service.ts` — `getPropertyMarketRange(ctx)`: kaskáda zdrojů.
- Tier 1 `market_cache` (PG) → Tier 2 Sreality API (segment, rate-limited) → Tier 3 vlastní DB kompy z `properties` (filtruje novostavby + vzorky < 5 000 Kč/m²) → Tier 4 `MARKET_DATA` (hardcoded) → Tier 5 fallback.
- `src/lib/scraping/sreality-sitemap.ts` — shared sitemap parser; `SrealityAdapter.crawlCityListings(cityKey)`.
- `market_cache` PK `(city, segment)`, sloupce low/high/median/sample_size/source/fetched_at/payload. DB TTL 24h.
- **Neon**: DB založena přes `drizzle-kit push` → NEMÁ `__drizzle_migrations`. Migrace se aplikují ručně SQL. `drizzle-kit push` může zablokovat interactive prompt (př. unique constraint na 96 řádcích `off_market_leads`).
- Skripty: `scripts/reanalyze.ts` (progress log), `scripts/live-market-check.ts [city]`, `scripts/check-migration.ts`.

## Key Files
- `src/lib/analysis/flip-costs.ts` — flip calculator (no VAT, tax fixed 21%)
- `src/components/calculator/interactive-analysis.tsx` — main calculator (editable target price, ROI slider step 0.1)
- `src/components/report/property-report.tsx` — PDF report (scoring box removed, sourcing fee matched with calc)
- `src/lib/scraping/orchestrator.ts` — scraping engine
- `src/lib/scraping/url-scraper.ts` — single URL scraper
- `src/lib/scraping/market-price-service.ts` — market price cascade Tier 1-5
- `src/lib/scraping/sreality-sitemap.ts` — sreality sitemap parsing + city sampling
- `src/components/auctions/auction-analyzer.tsx` — 1-Click DD (URL input)
- `src/components/auctions/auction-calculator.tsx` — výkupní kalkulačka + PDF print sekce
- `src/lib/auctions/parse-auction.ts` — DD pipeline kostra (HTML → PDF → Gemini)
- `src/app/api/parse-auction/route.ts` — mock endpoint
- `scripts/drazby_hunter.py` — Dražby data collector
- `src/app/(dashboard)/off-market/` — Dražby UI (route off-market)
- `src/app/api/off-market/` — Dražby API (leads + regions)

## Scraper Architecture
- `crawlAll` runs all portals **in parallel** (Promise.allSettled).
- Stale deactivation: bulk `UPDATE ... WHERE NOT IN` (was N+1).
- Re-analysis only on price change (was every crawl).
- `saveListing` passes `listing.portalName` to `filterImages` (was missing).
- All adapters call `enrichListing()` in `crawlListings()`.

## Common Tasks
- Add portal: implement adapter in `src/lib/scraping/adapters/` → register in both trigger routes + url-scraper.
- Run tests: `npm test`.
- Build: `npx next build`.
- Run Python scraper locally: `$env:OFF_MARKET_API_TOKEN="..." ; $env:OFF_MARKET_API_URL="..." ; python scripts/drazby_hunter.py`
