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
- **Testing**: Vitest v4 + jsdom + @testing-library/react (233 tests, 17 files)

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

> **Aktualizováno**: 1-Click DD už **není mock** — `parseAuction()` stahuje JSON detailu (`/drazba/{slug}.json`), PDF dokumenty (fallback) a extrahuje dlužníka/plochu/stav/dluhy přes Gemini. Analyzer → kalkulačka propojeny, `maxDuration = 60`.

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

### Phase 19 — UI Polish (Done)
- Oprava mojibake (rozbité UTF-8 z PowerShell WriteAllText) v 5 souborech: `price-index-card`, `register`, `save-deal`, `create-from-url` (funkční bug porovnání "Neznámá"), `czso`.
- Jednotný fallback fotek `PropertyImage` (shimmer + skóre/ikona) — nahrazeny prázdné boxy po `onError`.
- Přetečení textu: toolbar `flex-wrap` (mobile), InfoBox `break-words`, adresa `line-clamp` + tooltip, název karty `line-clamp-2`.
- Zvýraznění ROI/ARV v list view, CountUp na `Intl.NumberFormat("cs-CZ")`, konzistentní radii/snap/min font sizes.

### Phase 20 — Mapa + POI per čtvrť (Done)
- **Geokódování mapy**: `PropertyMap` volá `POST /api/geocode` (Nominatim) pro nemovitosti bez GPS → uloží lat/lng do `properties` (cache); "Načítám polohu…" stav; fallback text adresy. `src/lib/geocode.ts` (`geocodeAddress`, `cityKeyToName`, `reverseGeocode`).
- **POI per městská část**: `src/lib/scraping/sreality-detail.ts` (hash_id z URL → quarter_id + district_id + GPS ulice) + `fetchPoiForQuarter` v `poi.ts` (district + filtr čtvrti, diakritika normalizovaná). Cache segment `poi:quarter:{id}`.
- **Fallback mimo sreality**: `quarter-map.ts` (Nominatim suburb → sreality quarter_id + district_id). Záchranná síť = městský průměr.
- UI: profil zobrazuje čtvrť ("Plzeň 3").

### Phase 21 — Sekce audit + opravy (Done)
- **Nemovitosti**: `searchId` s 0 výsledky zobrazí prázdný stav (předtím ukázal všechny inzeráty).
- **Kontakty**: `POST /api/contacts` + `AddContactModal` (dříve mrtvé tlačítko "Přidat").
- **Nastavení**: wire-up `PATCH /api/settings/profile` (jméno/email/heslo) + `GET/PATCH /api/settings/preferences` (ROI, provize, právní, rezerva, reko Kč/m², jsonb/text parse). Odstraněna "Daň z převodu", defaults sladěny s flip-costs.
- **Call Mode**: textarea poznámek napojena na PATCH `/api/leads/[id]` (dříve se ztrácela).
- **Alerty**: preset "Lokalita" má korektní rules `{type:"location"}`.
- **Výkupy**: stale text (ISIR Hunter) odstraněn.

### Phase 22 — Pipeline drag & drop + miniatury (Done)
- **Fix drag & drop**: sloupce (stádia) dostaly `useDroppable` (`StageColumn`) — přetažení na prázdné stádium/mezeru dřív nefungovalo; `moveLead` zachovává leady cílového stádia; reorder z plného seznamu (ne toolbar-filtrovaného).
- **Miniatury**: `propertyImageUrl` v `/api/leads` (první foto z `imageUrls`), thumbnail na `LeadCard` (i v DragOverlay) a v `LeadDrawer`.

### Phase 23 — Stage-specific pipeline data (Done)
- `leads.stage_data` (SQLite text / Neon jsonb), `property_analysis.target_purchase_price`.
- **LeadDrawer** formuláře dle fáze: Schůzka (datum/lokalita), Nabídka (cena + předvyplnění z `targetPurchasePrice` + historie), Vyjednávání (částka + historie my/oni), Převod na deal (cena předvyplněná z nabídky).
- Badge 📅/💰 na `LeadCard`; Call Mode panel "Nadcházející schůzky".
- `targetPurchasePrice` persistován ve všech write paths (orchestrator, create-from-url, calc-save, PATCH, create-from-auction).
- **Fix stale-state**: LeadDrawer rozdělen na `LeadDrawerContent` keyed per `lead.id` (formuláře se dřív nezobrazovaly — state se neresetoval).

### Phase 24 — Analyzátor: reality.idnes.cz + realitymat.cz (Done)
- **iDnes**: fix URL pattern `/reality\.idnes\.cz/` (předtím nikdy nezachytil), jméno kontaktu `h2.b-author__title a`, cena odolává `&zwj;` (zero-width joiner), email vyčištěn od `?subject=`.
- **Realitymat**: nový scraper — `realitymat-parser.ts` (sdílený detail parser vč. telefonu z `#seller-modal`) + `adapters/realitymat.ts` (search `/prodej/byty`, 5 stránek, jen prodej bytů). Registrace do trigger + search-run.

### Phase 25 — Bazos paginace + Bezrealitky do Hledání (Done)
- **Bazos**: fix paginace — offset `/20/`, `/40/` místo `strana/2/` (page 2+ → HTTP 404 → crawler spadl).
- **Bezrealitky**: nový scraper pro Hledání — `bezrealitky-parser.ts` (sdílený parser z `__NEXT_DATA__` Apollo cache: `parseBezrealitkyAdvert`/`parseBezrealitkyDetail`/`parseBezrealitkySearch`, resolve `Image:` refů) + `adapters/bezrealitky.ts` (search `/vyhledat?…&offerType=PRODEJ&estateType=BYT&page=N`). `scrapeBezrealitky` v url-scraperu refaktorován na sdílený parser.
- **9 portálů v Hledání**: sreality, idnes-reality, realitymat, bezrealitky, bazos, mmreality, annonce, reality-cz, hyperinzerce.

### Phase 26 — Remax adapter + vyřazení hyperreality/century21 (Done)
- **Remax**: `adapters/remax.ts` — search na `remax-czech.cz/reality/vyhledavani/?sale=1&types[0]=4` (byty na prodej), data z `data-*` atributů kartiček (`pl-items__item`: title/price/img/gps/display-address/url), DMS→decimální GPS, paginace `stranka`. Detail je Vue-renderovaný (kontakt přes API), data se berou ze search stránky. Registrace do trigger + search-run.
- **Hyperreality**: doména je teď GitLab sign-in (procorp) — portál zanikl, `enabled: false`.
- **Century21**: trvalá bot protection (HTTP 429) — bez headless browseru nescrapovatelné, `enabled: false`.
- **10 portálů v Hledání** (8 aktivních adapterů): sreality, idnes-reality, realitymat, bezrealitky, bazos, mmreality, annonce, reality-cz, hyperinzerce, remax.

## Remaining
- Broader dedup/cache persistence (Redis or DB-based).
- Neon nemá `__drizzle_migrations` — nové migrace aplikovat ručně SQL (`drizzle-kit push` blokuje interactive prompts).
- AI guard spouští Gemini jen pro podezřelá data; při 503 (high demand) tichý fallback na null (bez badge).
- Nominatim reverse-geocode je u čtvrtí nepřesný (Bory → "Severní Předměstí" → Plzeň 1 místo Plzeň 3) — pro sreality inzeráty je čtvrť přesná z detailu; fallback je hrubší.
- `quarter-map.ts` — sreality district_id per město (Praha per správní obvod 5001-5010; Brno 72, Ostrava 65, Ústí 27, Olomouc 42, KV 10, Cheb 9, Plzeň 12, Liberec 22, Pardubice 32, Hradec 28, Zlín 38, Jihlava 67, ČB 1). Ověřeno na sreality API — POI quarter filtr vrací výsledky.
- hyperreality (doména = GitLab login), century21 (429 bot protection) — bez adapteru, `enabled: false`.

## Key Files

### Core
- `src/db/index.ts`, `src/db/schema/*.ts`, `src/db/pg/*.ts`
- `src/lib/auth.ts`, `src/lib/utils.ts`

### Scraping
- `src/lib/scraping/orchestrator.ts`
- `src/lib/scraping/url-scraper.ts`
- `src/lib/scraping/types.ts`
- `src/lib/scraping/realitymat-parser.ts` — sdílený detail parser realitymat.cz (vč. telefonu z modalu)
- `src/lib/scraping/bezrealitky-parser.ts` — sdílený parser bezrealitky (NEXT_DATA Apollo cache: advert/detail/search)
- `src/lib/scraping/adapters/` — 10 adapters (sreality, idnes-reality, realitymat, bezrealitky, bazos, mmreality, annonce, reality-cz, hyperinzerce, remax)

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
- `src/lib/locality/sldb.ts` — ČSÚ věková struktura per ORP (SLDB 2021) + firmy per obec (RES)
- `src/lib/locality/crime.ts` — PČR XLSX kriminalita per kraj
- `src/lib/locality/poi.ts` — sreality POI vzdálenosti → walkability (per město i per čtvrť)
- `src/lib/locality/quarter-map.ts` — název čtvrti (Nominatim) → sreality quarter_id + district_id
- `src/lib/locality/rent.ts` + `src/lib/scraping/rent-scraper.ts` — nájmy + hrubý výnos
- `src/lib/locality/transport.ts` — dopravní skóre + prémie
- `src/lib/locality/score.ts` — normalizace dimenzí + vážené skóre (±8 na investmentScore)
- `src/lib/scraping/sreality-detail.ts` — detail API (hash_id → quarter_id + GPS ulice)
- `src/lib/geocode.ts` — Nominatim geokódování + reverse-geocode (mapa, POI fallback)
- `src/lib/ai/locality-guard.ts` — Gemini sanity-check (AI dohled)
- `src/components/properties/locality-profile.tsx` — UI blok v detailu
- `src/components/market/locality-markets.tsx`, `price-index-card.tsx`, `buy-vs-rent.tsx` — Trh

### Pipeline (Leads)
- `src/components/leads/leads-board.tsx`, `lead-card.tsx`, `lead-drawer.tsx`, `leads-toolbar.tsx`, `types.ts`
- `src/lib/leads.ts` — LEAD_STAGES
- `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts`, `src/app/api/leads/[id]/convert/route.ts`
- `lead-drawer.tsx` — rozdělen na `LeadDrawer` (overlay) + `LeadDrawerContent` (keyed per lead), stage-specific formuláře (meeting/offer/negotiation) ve `stageData`

### API
- `src/app/api/scraping/trigger/route.ts`
- `src/app/api/searches/[id]/run/route.ts`
- `src/app/api/favorites/toggle/route.ts`
- `src/app/api/properties/[id]/calc-preset/route.ts`
- `src/app/api/properties/[id]/route.ts` — GET + PATCH (plocha/re-analýza) + DELETE
- `src/app/api/contacts/route.ts` — GET + POST (vytvoření kontaktu)
- `src/app/api/settings/profile/route.ts` — PATCH (jméno/email/heslo)
- `src/app/api/settings/preferences/route.ts` — GET/PATCH kalkulačka defaults (jsonb/text)
- `src/app/api/locality/[cityKey]/route.ts`, `src/app/api/locality/refresh/route.ts`
- `src/app/api/market/price-index/route.ts`
- `src/app/api/geocode/route.ts` — Nominatim geokódování adresy + uložení GPS do properties

### Tests
- `vitest.config.ts`
- `src/lib/__tests__/flip-costs.test.ts`
- `src/lib/__tests__/utils.test.ts`
- `src/lib/__tests__/condition.test.ts`
- `src/lib/__tests__/location.test.ts`
- `src/lib/__tests__/leads.test.ts`
- `src/lib/__tests__/locality.test.ts` — locality skóre (unemployment, migration, crime, walkability, rent, transport)
- `src/lib/__tests__/replacement-cost.test.ts` — reprodukční cena
- `src/lib/__tests__/geocode.test.ts` — cityKeyToName
- `src/lib/__tests__/quarter.test.ts` — sreality hash_id extrakce + čtvrti → quarter_id
- `src/lib/analysis/__tests__/analyzer-arv.test.ts`
- `src/lib/scraping/__tests__/adapters-image.test.ts`
- `src/lib/scraping/__tests__/filters.test.ts`
- `src/lib/scraping/__tests__/market-price-service.test.ts`
- `src/lib/scraping/__tests__/bazos-pagination.test.ts` — offset paginace URL
- `src/lib/scraping/__tests__/bezrealitky-parser.test.ts` — advert konverze + search parsing
