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
Vitest v4 + jsdom + @testing-library/react. **233 tests across 17 files**.
`npm test` or `npx vitest run`.

## Portals (9 adapters, 6 url-scrapers)
sreality, bezrealitky, bazos, reality-cz, hyperinzerce, annonce, mmreality, idnes-reality, realitymat (+ remax, century21, hyperreality as not-implemented)
- **Hledání**: všechny 9 registrované v `searches/[id]/run` + `scraping/trigger`.
- **Analyzátor** (url-scraper): sreality, bezrealitky, reality.cz, hyperinzerce, annonce, bazos, mmreality, reality.idnes.cz, realitymat.cz.
- `realitymat-parser.ts` (sdílený detail parser vč. telefonu z `#seller-modal`), `bezrealitky-parser.ts` (NEXT_DATA Apollo cache: advert/detail/search).

## Image Pipeline
- `filterImages()` + `normalizeImageUrl()` in `types.ts` — central gatekeeper.
- `PORTAL_BASE_URLS` — root-relative → absolute for 7 portals.
- Sreality CDN images require `?fl=res,1200,1200,1|wrm,/watermark/sreality.png,10|shr,,20|webp,80` appended.
- Orchestrator saves with portalName (fix: was missing, root-rel URLs dropped).

## Dražby → Výkupy (Auctions Module)
- Nav label "Výkupy" (Gavel), route `/vykupy`, `/vykupy/[id]`; stará `/off-market` redirectuje. API `/api/vykupy/*`, DB `vykupy_leads`, `vykupy_regions`.
- **1-Click Due Diligence** (`AuctionAnalyzer`): input URL z portaldrazeb.cz → POST `/api/parse-auction` → **reálná pipeline** `src/lib/auctions/parse-auction.ts`: JSON detailu (`/drazba/{slug}.json`) → PDF dokumenty (fallback — vyžadují login) → Gemini extrakce (debtor, plocha, stav, dluhy, břemena) → fotky (`/media/cache/thumb_large`).
- **Kalkulačka výkupu před dražbou** (`AuctionCalculator` + `src/lib/auctions/auction-flip-costs.ts`): AsIs TMV (100 % trhu), TD, položkové TC, sleva (default 30 % → 70 % pravidlo), reko presety, ARV, ROI slider.
  - `TBP = AsIs × (100 − sleva)/100`; `NCO = TBP − TD − TC`.
  - NCO > 0 → realizovatelné; NCO ≤ 0 → haircut s věřiteli.
  - Bez hypotéky a znaleckého posudku. Volitelné: Provize RK (default OFF), Sourcing fee (Kč/%, default OFF = model 50/50).
  - Metriky: zisk/ROI/roční ROI/cash-on-cash, strop (cílové ROI), break-even, argument vs. dražba (NP − TD).
  - localStorage klíč `auction-calculator:v2`.
- **Uložení**: tlačítko "Uložit do databáze" → `POST /api/properties/create-from-auction` → `properties` (portalName=`portaldrazeb`, fotky, `auctionDataJson`) + `propertyAnalysis` → detail `/properties/[id]` → "Zahájit jednání" (`/api/properties/[id]/initiate`, kontakt typ `debtor`, tag "z dražby") → pipeline.
- **Dvojité PDF reporty**: `/report/[id]` u portaldrazeb (branch dle portalName) a `/report/auction` (sessionStorage, z kalkulačky bez uložení). `AuctionReport` komponenta s tabs Investor/Majitel + "Stáhnout PDF"/"Vytisknout". Majitel report = `OwnerReportContent` (rozpad ceny, bez investor dat).
- Leads list (Portál dražeb hunter) = kolapsovatelná sekce pod kalkulačkou.
- DB: `vykupy_leads`, `vykupy_regions` (standalone, no FK). Python `scripts/drazby_hunter.py` denně přes GitHub Actions (env `VYKUPY_API_URL`, `VYKUPY_API_TOKEN`).

## Market Data Cascade (Tier 1-5)
- `src/lib/scraping/market-price-service.ts` — `getPropertyMarketRange(ctx)`: kaskáda zdrojů.
- Tier 1 `market_cache` (PG) → Tier 2 Sreality API (segment, rate-limited) → Tier 3 vlastní DB kompy z `properties` (filtruje novostavby + vzorky < 5 000 Kč/m²) → Tier 4 `MARKET_DATA` (hardcoded) → Tier 5 fallback.
- `src/lib/scraping/sreality-sitemap.ts` — shared sitemap parser; `SrealityAdapter.crawlCityListings(cityKey)`.
- `market_cache` PK `(city, segment)`, sloupce low/high/median/sample_size/source/fetched_at/payload. DB TTL 24h.
- **Neon**: DB založena přes `drizzle-kit push` → NEMÁ `__drizzle_migrations`. Migrace se aplikují ručně SQL. `drizzle-kit push` může zablokovat interactive prompt (př. unique constraint na 96 řádcích `vykupy_leads`).
- Skripty: `scripts/reanalyze.ts` (progress log), `scripts/live-market-check.ts [city]`, `scripts/check-migration.ts`.

## Key Files
- `src/lib/analysis/flip-costs.ts` — flip calculator (no VAT, tax fixed 21%)
- `src/components/calculator/interactive-analysis.tsx` — main calculator (editable target price, ROI slider step 0.1)
- `src/components/report/property-report.tsx` — PDF report (scoring box removed, sourcing fee matched with calc)
- `src/lib/scraping/orchestrator.ts` — scraping engine
- `src/lib/scraping/url-scraper.ts` — single URL scraper
- `src/lib/scraping/market-price-service.ts` — market price cascade Tier 1-5
- `src/lib/scraping/sreality-sitemap.ts` — sreality sitemap parsing + city sampling
- `src/lib/scraping/realitymat-parser.ts` — sdílený detail parser realitymat.cz
- `src/lib/scraping/bezrealitky-parser.ts` — sdílený parser bezrealitky (NEXT_DATA Apollo cache)
- `src/components/auctions/auction-analyzer.tsx` — 1-Click DD (URL input)
- `src/components/auctions/auction-calculator.tsx` — kalkulačka výkupu před dražbou + uložení do properties
- `src/components/report/auction-report.tsx` — dvojité PDF reporty (Investor/Majitel)
- `src/lib/auctions/parse-auction.ts` — DD pipeline (JSON API + PDF fallback → Gemini)
- `src/lib/auctions/auction-flip-costs.ts` — výpočty (TBP/NCO/ROI/strop/break-even/50-50 vs SF)
- `src/app/api/parse-auction/route.ts` — reálná pipeline
- `src/app/api/properties/create-from-auction/route.ts` — uložení dražby do properties
- `scripts/drazby_hunter.py` — Dražby data collector
- `src/app/(dashboard)/vykupy/` — Výkupy UI (route vykupy)
- `src/app/api/vykupy/` — Výkupy API (leads + regions)
- `src/app/api/settings/profile/route.ts` — PATCH profil (jméno/email/heslo)
- `src/app/api/settings/preferences/route.ts` — GET/PATCH kalkulačka defaults (jsonb/text parse)
- `src/lib/alert-matcher.ts` — price_drop + score_threshold alerty (volané z orchestratoru)

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
- Run Python scraper locally: `$env:VYKUPY_API_TOKEN="..." ; $env:VYKUPY_API_URL="..." ; python scripts/drazby_hunter.py`

## Pipeline (Leads CRM)
- Route `/leads` (client `LeadsBoard`), 7 fází v `src/lib/leads.ts` (`LEAD_STAGES`, barevné tečky `dot`).
- Komponenty `src/components/leads/`: `leads-board.tsx` (DndContext + SortableContext + DragOverlay + **StageColumn s useDroppable** — přetažení funguje i na prázdné stádium; `moveLead` zachovává leady cílového stádia; reorder z plného seznamu), `lead-card.tsx` (auto-zhuštění přes Tailwind v4 container queries `@max-[240px]:`; **thumbnail** `propertyImageUrl`), `lead-drawer.tsx` (**rozdělen na `LeadDrawer` + `LeadDrawerContent` keyed per lead.id** — jinak stale-state; slide-over, PATCH stage/priority/notes/stageData, převod na deal z `closed`), `leads-toolbar.tsx` (search/filter/sort), `types.ts` (`LeadItem` + `StageData`).
- **Stage-specific data** (`leads.stage_data`, SQLite text / Neon jsonb): fáze Schůzka (datum/lokalita), Nabídka (cena + historie, předvyplnění z `analysisTargetPurchasePrice`), Vyjednávání (částka + historie my/oni). Badge 📅/💰 na kartě. Call Mode panel "Nadcházející schůzky" (leady ve fázi meeting s datem).
- `GET /api/leads` zobrazuje kontakt z properties (coalesce) + `propertyImageUrl` + `analysisTargetPurchasePrice`/`analysisArv`.
- Initiate dedup kontaktů: **phone + name** (ne jen phone) v `src/app/api/properties/[id]/initiate/route.ts`.
- Sloupce boardu `flex-1 basis-0 min-w-[170px]` — vejdou se do 1400px kontejneru bez scrollu.

## Lokalitní inteligence (Locality Intelligence)
- Modul `src/lib/locality/`: reálná data z ČSÚ, PČR a sreality. **Žádná vymyšlená čísla — chybějící data = null/0, nikdy odhad.**
- **Nezaměstnanost** (`czso.ts`): ČSÚ NKOD DCAT, dataset **2023** (Iri `b5c4d539...`), `cityKeyForMunicipality` = přesná shoda názvu (ne substring — "Plzeň-sever" se nemapuje na plzen). URL se řeší dynamicky přes NKOD.
- **Migrace/obyvatel** (`czso.ts`): ČSÚ 2024 (`DEM0001` migrace, `DEM0026B` obyvatel), největší obec s názvem = skutečné město.
- **Kriminalita** (`crime.ts`): **PČR XLSX statistiky** (prosinec 2025), per kraj → index TČ/100k, cache 30 dní v `locality_metrics` (source `pcr-crime`). NIKDY statická mapa.
- **POI/Walkability** (`poi.ts`): **sreality API** medián vzdáleností k POI (`poi_*_distance`) — NE Overpass (nestabilní 406/timeout). Cache v `rents` (segment `poi:quarter:{id}` per čtvrť, nebo `poi` per město), sloupce `walkability`+`counts_json`, min 3 vzorky.
  - **Priorita POI**: 1) sreality detail (`sreality-detail.ts` z `properties.url` hash_id) → `quarter_id`+`district_id`+GPS ulice → POI per čtvrť; 2) Nominatim reverse-geocode GPS → `quarter-map.ts` (čtvrť → quarter_id) → POI per čtvrť; 3) městský průměr.
  - `locality_quarter_id` v sreality search je nespolehlivý napříč městy → kombinace `locality_district_id` (okres) + filtr názvu čtvrti v kódu. Diakritika normalizovaná (`normalizeCity`).
- **Renta** (`rent.ts` + `scraping/rent-scraper.ts`): sreality nájmy (`category_type_cb=2`), **min 5 vzorků** jinak null (žádný fallback 0,5 %).
- **Doprava** (`transport.ts`): sreality `poi_metro/train/bus_distance`, transport skóre (`scoreTransportDistance` v score.ts), prémie cena/m² vs dostupnost (korelace).
- **Cenový index** (`src/lib/market/price-index.ts`): IQR outliery, robustní medián base, min 5 vzorků per segment, segmenty <5 skryté v UI.
- **Reprodukční cena** (`analysis/replacement-cost.ts`): orientační sazby Kč/m² dle konstrukce (cihla 38k, panel 30k...) — jasně označeno "orientační" v reportu.
- **AI dohled** (`src/lib/ai/locality-guard.ts`): Gemini sanity-check POUZE pro podezřelá data (`needsLocalityGuard`), prompt zakazuje vymýšlet, verdikt v `propertyAnalysis.aiLocalityVerdict` + badge v UI.

## DB — locality tabulky
- `locality_metrics` PK `(city_key, source, period)`, `json_data`, `fetched_at`.
- `rents` PK `(city_key, segment)` — segmenty: `any` (nájmy), `transport` (prémie), `poi` (walkability město), `poi:quarter:{id}` (walkability čtvrť). Sloupce navíc `walkability`, `counts_json`.
- `propertyAnalysis` + `localityScore`, `localityFactorsJson`, `aiLocalityVerdict` (ALTER na Neon manuálně).

## Mapy a geokódování
- `PropertyMap` (`src/components/ui/property-map.tsx`): Leaflet + OSM tiles. Když nemovitost nemá GPS → volá `POST /api/geocode` → Nominatim → uloží lat/lng do `properties` (cache), mezitím "Načítám polohu…". Fallback při selhání: text adresy.
- `src/lib/geocode.ts`: `geocodeAddress(address, cityKey)` (adresa+město → Nominatim, fallback jen město), `cityKeyToName`, `reverseGeocode(lat,lng)` → suburb/city (pro POI čtvrť).
- Nominatim vyžaduje `User-Agent`; adresa "Lesní, Cheb" geokóduje správně (Pelhřimov = čtvrť Chebu).

## Trh (Market) — investiční nástroje
- `src/app/(dashboard)/market/page.tsx` server komponenta: agregace nabídkových cen + `LocalityMarkets` (tabulka lokalit se skóre), `PriceIndexCard` (cenový index, `/api/market/price-index`), `BuyVsRentCalculator` (30letá simulace koupě vs nájem).
- `LocalityProfile` v detailu nemovitosti (`/properties/[id]` sidebar): 6 dimenzí (ekonomika, demografie, vybavenost, doprava, bezpečnost, rentový výnos) + AI badge.

## Scraper notes (nové)
- Rent scraper `src/lib/scraping/rent-scraper.ts` — ceny z `price_czk_m2`/`price_czk`, plocha z názvu.
- Transport scraper v `transport.ts` — `poi_*_distance` z sreality search API.
- Refresh: `scripts/refresh-locality.ts` (ČSÚ + renty + transport + POI per city) — musí importovat `./_env` PŘED db (tsx skripty nemají Next env).
