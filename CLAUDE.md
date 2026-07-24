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
Vitest v4 + jsdom + @testing-library/react. 136 tests across 5 files.
`npm test` or `npx vitest run`.

## Portals (10 adapters, 6 url-scrapers)
sreality, bazos, reality-cz, hyperinzerce, annonce, mmreality, idnes-reality (+ bezrealitky, remax, century21, hyperreality as not-implemented)

## Image Pipeline
- `filterImages()` + `normalizeImageUrl()` in `types.ts` — central gatekeeper.
- `PORTAL_BASE_URLS` — root-relative → absolute for 7 portals.
- Sreality CDN images require `?fl=res,1200,1200,1|wrm,/watermark/sreality.png,10|shr,,20|webp,80` appended.
- Orchestrator saves with portalName (fix: was missing, root-rel URLs dropped).

## Off-Market Module
- Standalone section `/off-market`, `/off-market/[id]`.
- DB tables: `off_market_leads`, `off_market_regions` (standalone, no FK).
- Data source: Portál dražeb API (`/drazby/pripravovane.json`, `/drazby/probihajici.json`).
- Python script `scripts/drazby_hunter.py` — daily via GitHub Actions. Fetches real estate auctions, sends to API.
- UI: table with filters (status, region, category), detail with status management, letter template modal.

## Scraper Architecture
- `crawlAll` runs all portals **in parallel** (Promise.allSettled).
- Stale deactivation: bulk `UPDATE ... WHERE NOT IN` (was N+1).
- Re-analysis only on price change (was every crawl).
- `saveListing` passes `listing.portalName` to `filterImages` (was missing).
- All adapters call `enrichListing()` in `crawlListings()`.

## Key Files
- `src/lib/analysis/flip-costs.ts` — flip calculator (no VAT, tax fixed 21%)
- `src/components/calculator/interactive-analysis.tsx` — main calculator (editable target price, ROI slider step 0.1)
- `src/components/report/property-report.tsx` — PDF report (scoring box removed, sourcing fee matched with calc)
- `src/lib/scraping/orchestrator.ts` — scraping engine
- `src/lib/scraping/url-scraper.ts` — single URL scraper
- `scripts/drazby_hunter.py` — Off-Market data collector
- `src/app/(dashboard)/off-market/` — Off-Market UI
- `src/app/api/off-market/` — Off-Market API (leads + regions)

## Common Tasks
- Add portal: implement adapter in `src/lib/scraping/adapters/` → register in both trigger routes + url-scraper.
- Run tests: `npm test`.
- Build: `npx next build`.
- Run Python scraper locally: `$env:OFF_MARKET_API_TOKEN="..." ; $env:OFF_MARKET_API_URL="..." ; python scripts/drazby_hunter.py`
