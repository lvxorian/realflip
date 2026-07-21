@AGENTS.md

# RealFlip — Working Context

## Auth
`cakmak@tuta.com` / `realflip2026` — NextAuth v5, JWT, credentials + Google OAuth.

## DB
Neon PostgreSQL (prod) + SQLite `data.db` (local). Drizzle ORM. Migrations via `drizzle-kit push`.
**All timestamps = epoch-ms.** Use `ts()` (= `Date.now()`) for DB writes.

## Design
Pure dark UI only (no light mode). Emerald `#10b981` accent, dark bg `#0f0f11`, rounded-2xl cards, Geist font, `@phosphor-icons/react`.
All `<img>` tags: `referrerPolicy="no-referrer"` + `loading="lazy"` + `decoding="async"` + `onError`.

## Key Rules
- **VAT rule**: Pure flip (FO→FO) = sale VAT-exempt without deduction right (§51). Input VAT on renovation CANNOT be claimed. `isVatPayer` removed entirely.
- **Sell commission**: 5% default, configurable.
- **Phone**: `formatPhone()` → `+420 608 033 397`.
- **Cron**: 6:00, 14:00, 22:00 UTC via Vercel Cron. Bypasses auth via `x-vercel-cron` header.

## Test Stack
Vitest v4 + jsdom + @testing-library/react. `vitest.config.ts`. Run: `npm test` or `npx vitest run`. 126 tests across 4 files.
Currently using `data.db` — to switch: update `src/db/index.ts`.

## Dead Deps Removed
`lucide-react` (29 MB), `react-leaflet` — zero imports.

## Image Pipeline
- **`filterImages()`** in `types.ts` — central gatekeeper. Normalizes URL, strips placeholders/data URIs/svgs.
- **`PORTAL_BASE_URLS`** in `types.ts` — must have entry for each portal (root-relative → absolute). Currently: sreality, reality-cz, hyperinzerce, annonce, bazos, mmreality, idnes-reality.
- **Orchestrator** also calls `filterImages()` on save (safety net). Protects against overwriting good images with fewer ones.
- **idnes-reality** had missing enrichment + filterImages — fixed.
- All adapters must call `enrichListing()` in `crawlListings()` for full-res gallery images (not just search thumbnails).

## Portals (10)
sreality, bezrealitky, bazos, remax, century21, reality-cz, hyperreality, mmreality, annonce, idnes-reality

## Key FIles
- `src/lib/analysis/flip-costs.ts` — flip calculator (no VAT)
- `src/components/calculator/interactive-analysis.tsx` — main analysis card
- `src/lib/scraping/orchestrator.ts` — scraping engine w/ AlertMatcher
- `src/lib/scraping/url-scraper.ts` — single URL scraper
- `src/app/api/scraping/trigger/route.ts` + `searches/[id]/run/route.ts` — both register all 10 adapters

## Common Tasks
- Add portal: `src/lib/scraping/adapters/` → implement `PortalAdapter` → register in both trigger routes.
- Run tests: `npm test`.
- Run single test: `npx vitest run src/lib/__tests__/flip-costs.test.ts`.
- Check cron: `GET /api/scraping/trigger` (needs x-vercel-cron header in prod).
