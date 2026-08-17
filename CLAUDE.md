@AGENTS.md

# RealFlip — Working Context

## Auth
`cakmak@tuta.com` / `realflip2026` — NextAuth v5, JWT, credentials + Google OAuth.
Splash animace při přihlašování: `LoginSplash` (`src/components/auth/login-splash.tsx`) — video `public/realflip-animation.mp4` (1,8 MB, z `realflip animace 2.mov`), vycentrované v poloviční velikosti okna (50vw×50vh, object-contain, loop), `onPlayedOnce` → navigace až po prvním celém průchodu videa.

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
- **Částkové vstupy**: všude používat `AmountInput` (`src/components/ui/amount-input.tsx`) nebo `Input type="amount"` — `type="text"` + `inputMode="numeric"`, živě formátuje mezery („5000000" → „5 000 000"), `onChange` předává jen číslice (stávající `Number`/`parseInt` parsování funguje beze změny). Sdílené formátování: `formatAmountInput()` v `src/lib/utils.ts`. Procenta/m²/plochy/roky = obyčejná číselná pole bez formátování.

## Test Stack
Vitest v4 + jsdom + @testing-library/react. **641 tests across 46 files**.
`npm test` or `npx vitest run`.

## Portals (10 adapters, 6 url-scrapers)
sreality, bezrealitky, bazos, reality-cz, hyperinzerce, annonce, mmreality, idnes-reality, realitymat, remax (+ hyperreality, century21 disabled — hyperreality.cz je teď GitLab login, century21 má 429 bot protection)
- **Hledání**: všech 10 registrovaných v `searches/[id]/run` + `scraping/trigger`.
- **Analyzátor** (url-scraper): sreality, bezrealitky, reality.cz, hyperinzerce, annonce, bazos, mmreality, reality.idnes.cz, realitymat.cz.
- `realitymat-parser.ts` (sdílený detail parser vč. telefonu z `#seller-modal`), `bezrealitky-parser.ts` (NEXT_DATA Apollo cache: advert/detail/search).
- `remax.ts` — search data-* atributy kartiček (`data-title/price/gps/url`), byty sale filter, DMS→dec GPS, paginace `stranka`.

## Image Pipeline
- `filterImages()` + `normalizeImageUrl()` in `types.ts` — central gatekeeper.
- `PORTAL_BASE_URLS` — root-relative → absolute for 7 portals.
- Sreality CDN images require `?fl=res,1200,1200,1|wrm,/watermark/sreality.png,10|shr,,20|webp,80` appended.
- Orchestrator saves with portalName (fix: was missing, root-rel URLs dropped).
- **Zobrazení bez ořezu**: `PropertyImage`/`ImageGallery` boxy **8:5** (`aspect-[8/5]`, galerie respektuje přirozený poměr foto) — žádné ořezávání shora/zdola ani pruhy po stranách.
- **Popis bez HTML**: `cleanHtmlToText()` in `types.ts` — `<br>`/`<p>`/`<li>` → nové řádky, ostatní tagy + entity pryč (sreality API vrací popis jako HTML).
- **Realitymix**: `extractRealityMixImages($)` — celá galerie (main + small `data-src` + hidden-items), http→https, strip `_detail`/`_nahled`, dedup.
- **Dedup napříč portály**: `properties.alt_portals` (text/jsonb) — duplicita z jiného portálu se nepřidá jako nový záznam, jen do `alt_portals` (helpers `property-match.ts`: `parseAltPortals`, `appendAltPortal`, `hasAltUrl`, `toDbAltPortals`). Orchestrator: deaktivace i oživení (`toRescue`) respektují alt URL, `saveListing` jen doplní chybějící údaje.

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
- Kaskáda (po paměťové 15 min + DB 24 h cache `(město, segment)`): Tier 1 vlastní DB kompy z `properties` (GPS okruhy 5→10 km→město, segment, plocha ±30 %, posledních 90 dní) → Tier 2 (odstraněn, viz níže) → Tier 3 sitemap + detail API vzorky (~80 na město, city-filtrované) → Tier 4 `MARKET_DATA` (hardcoded) → Tier 5 fallback.
- **Tier 2 (sreality search API) byl odstraněn** (2026-08): ověřeno, že API ignoruje všechny `locality_*` parametry a vrací celorepublikový feed (total=20730 pro každý dotaz). Tier 4 sitemap vzorky jsou korektní city-filtrovaný live zdroj.
- **ARV z renovovaného segmentu**: `getAnalysisRanges(ctx)` volá kaskádu 2× — jednou se `condition` stavu nemovitosti (tržní rozmezí pro hodnocení ceny) a jednou s `condition: "renovated"` (ARV horní hranice po reko). `analyzeListing(..., dynamicRange, ..., arvRange)` — ARV = `arvRange.high × 0.95`. Pro stav `renovated`/`new`/`good` se range sdílí.
- **Editovatelný stav**: `EditableCondition` (detail `/properties/[id]`, select 5 stavů) → `PATCH /api/properties/[id]` s `{ condition }`. Změna stavu spustí **žhavý přepočet** — route volá `getAnalysisRanges({ cityKey: analysis.locationCity, lat, lng, condition: new, buildingType, area, category })` a uloží čerstvé `marketSource`/`marketSampleSize`; při „Neznámá"/selhání fallback na uložené range. Změna plochy zůstává offline (uložený range).
- **Štítky stavů**: `CONDITION_LABELS` v `src/lib/utils.ts` — `new: Novostavba`, `renovated: Po rekonstrukci`, `good: Průměrný`, `original: Před rekonstrukcí`, `dilapidated: Neobyvatelný`, `project: Projekt`.
- `src/lib/scraping/sreality-sitemap.ts` — shared sitemap parser; `SrealityAdapter.crawlCityListings(cityKey)`.
- `market_cache` PK `(city, segment)`, sloupce low/high/median/sample_size/source/fetched_at/payload. DB TTL 24h.
- **Audit zdroje dat**: `property_analysis` nese `market_source` (`db`/`sreality`/`market_data`/`fallback`), `market_sample_size`, `arv_price_per_sqm_high` (Kč/m² renovovaný segment). Migrace `0010_market_audit.sql` + `scripts/migrate-market-audit.ts`. UI badge zdroje v `interactive-analysis.tsx` (`MarketSourceBadge`) + řádek v PDF reportu. Routy ukládající analýzu: `orchestrator.ts` (`ranges.dynamicRange.source/sampleSize`), `analyze-url`, `create-from-url`, `calculator/save`, `properties/[id]` (z DB), `scripts/reanalyze.ts`.
- **Neon**: DB založena přes `drizzle-kit push` → NEMÁ `__drizzle_migrations`. Migrace se aplikují ručně SQL. `drizzle-kit push` může zablokovat interactive prompt (př. unique constraint na 96 řádcích `vykupy_leads`).
- **Neon pooler**: DDL přehledem přes `neon()` (DATABASE_URL = `-pooler`) koji se **tiše neaplikuje** v transaction poolingu — ALTER musí jít přes přímé non-pooler připojení. Host má tvar `...pooler.c-4.eu-central-1...` — direct = `replace("-pooler", "")`. Skripty `scripts/migrate-area-resolution.ts` / `scripts/migrate-market-audit.ts` to řeší.
- **Aplikováno na Neon**: `0007_target_roi_real.sql` + `0008_investors.sql` (investors tabulka, deals.investor_id + FK set null) — ověřeno přes `@neondatabase/serverless` `sql.query`. Též `0010_market_audit.sql` (arv_price_per_sqm_high, market_source, market_sample_size).
- Skripty: `scripts/reanalyze.ts` (progress log), `scripts/live-market-check.ts [city]`, `scripts/check-migration.ts`.

## Odhad (Valuation)
- Modul `src/lib/valuation/`: `types.ts`, `price-map.ts` (Seznam cenová mapa SSR parse — realizované prodeje per kraj, cache 7 dní v `market_cache` source `price_map`), `czso-trend.ts` (ČSÚ index snapshot), `engine.ts` (vážený blend realizované 45 % / nabídky 35 % s vahou dle počtu vzorků a kvality zdroje / **kotva cenovky 10 %**, rozmezí, confidence 0–100, kompy), `ai.ts` (Gemini zdůvodnění, bez vymýšlení čísel).
- Komparace = jen lokální vzorky: GPS obou stran → okruh 10 km; chybí-li GPS, adresa musí obsahovat název města (`addressContainsCity`, word-boundary — nechytá „u mostu"). Váha nabídek dle kvality zdroje (db/sreality 1,0 / market_data 0,6 / fallback ČR 0,3). `CITY_TO_REGION` (crime.ts) pokrývá ~50 měst — Cheb→karlovarsky atd., bez něj realizované prodeje pro malá města nefungovaly. UI + PDF ukazují Kč/m² pod min/medián/maxem.
- Route `/odhad` (menu Odhad, ikona Scales) + API `POST /api/valuation` (URL → pole → ocenění) + PDF `/report/valuation` (sessionStorage).
- **Drill-down na město**: `getRealizedLocalityForCity` (price-map.ts) — veřejné API `GET /api/v1/price_map/list?...&locality=<entity_type>,<entity_id>` (region→district→municipality→**ward**, snake_case v odpovědi). Obec > okres > kraj > **čtvrť**; cache `market_cache` (segmenty `price_map_district`/`price_map_municipality`/`price_map_ward`, TTL 7 dní). Praha (region→rovnou čtvrti) a obec→čtvrť jen s adresou (`ctx: {address, lat, lng, wardHints}`); `findWardByHints` dle reverse geokódu Nominatimu. Adresa je povinná (route: geocode→GPS, reverse→wardHints). `/odhad?url=…` auto-načte inzerát (Suspense, čeká na session); odkazy „Odhad ceny" v detailu nemovitosti i Analyzátoru.
- **Engine robustnost**: váha nabídek dle počtu vzorků (min(sampleSize,8)/8) a kvality zdroje (db/sreality 1,0 / market_data 0,6 / fallback ČR 0,3), clamp nabídek do [0,75×; **1,15×**] realizovaných (bylo 1,25× — Phase 43), partial pooling (čtvrť nad krajem o >35 % → korekce 0,75/0,25 ke kraji — novostavby), srážka ×0,97 za běžný stav („good") u čtvrti/obce (mix novostaveb v průměru; **0,94 bylo moc** — s panelem ×0,75 by se odhad propadl −31 %), spread 0,05–**0,22** (cap; <100 tx +5 p.b., 100–1000 tx +1 p.b.), confidence cap 95 (nikdy 100 %). **Capy proti nafouknutým čtvrtím** (Phase 49–50): **asking cap** — cenovka ≥ 0,75× indexované čtvrti → hladina ≤ **1,05× cenovky**; **offers cap** — cenovka < 0,9× čtvrti A čtvrť > 1,2× nabídkový medián (novostavby v čtvrti, starý fond v inzerátu) → hladina ≤ 1,2× nabídky. **Indexace realizovaných na dnešek** (timeIndexFactor: střed okna → ČR trend cenové mapy, strop ±10 %; pořadí **index-first** — indexace surového průměru NEJDŘÍV, pak cap; label „indexováno na dnešek" jen u necapped hodnoty). DB kompy (Tier 1) vylučují novostavby (condition new) a u „any" aplikují multiplikátory — konzistence se sreality tierem. Multiplikátory (Phase 40, kalibrováno na Valuo): **panel 0,85** (ne 0,75 — průměr čtvrti už mix panel+cihla obsahuje; 0,75 by penalizoval dvakrát), **družstevní vlastnictví 0,86**, patro (přízemí 0,93 / 1. patro 0,98 / podkroví 0,93 / bez výtahu od 3. patra 0,90), balkón +4–10 %, zahrada +8–20 %, sklep +1–3 %, yearBuilt (<1945 0,96 … >2015 1,08), luxury 1,25, areaSizeFactor (exponent 0,25, clamp 0,7–1,3). K Lučinám (Žižkov, panel, 73 m²): **130 360 vs Valuo 129 385 Kč/m² = +0,8 %** (Phase 50 — offers cap; dříve 129 588 = 0 %, 152 488 = +8,3 %).
- **Stabilita/determinismus** (Phase 36): cache `market_cache` TTL kraj 7 dní → 1 den, čtení s `orderBy(fetchedAt desc)`, plausibilita (nečíst prázdné/zkorumpované payloady), 2× retry sitemap i drill. Cache nabídek (market-price-service) má v klíči **GPS bucket** (±0,5° ≈ 35 km), když máme souřadnice — okruhové výsledky nesdílí klíč s celoměstskými. Ověřeno determinismem: 2× stejný vstup = identický výstup (dřív skákalo 8,3M ↔ 11,2M kvůli stale cache).
- **Valuo-style vstupy** (Phase 40): vlastnictví (osobní/družstevní), celkem podlaží + výtah (podkroví, bez výtahu od 3. patra), balkón/zahrada/sklep v m², **období dat 6M/12M/24M** (`lookbackMonths`, auto: velká města z `LIQUID_CITIES` → 6M jako Valuo, malá 12M; okno se propisuje do URL cenové mapy i cache segmentu `price_map_district_6m`), **datum odhadu „k datu"** (`asOfDate` — okno končí zvoleným měsícem + `scaleToDate()` indexuje výsledek podle trendu realizovaných cen, interpolace, clamp ±40 %, ruší `vsAskingPct`).
- **AI korekce mikro-polohy** (`ai.ts`): `correctValuation(input, result)` — Gemini dostane adresu/čtvrť + srovnatelné (realizované i nabídky s odstupem) + **dopravu (Vlak Index)** a navrhne úpravu v % kolem statistického mediánu. `sanitizeAiCorrection` (pure, testovaná) clampuje úpravu na **±15 %** (model nemůže vymyslet libovolná čísla), přísně kontroluje `typeof adjustmentPct === "number"`, počítá `adjustedPricePerSqm`/`adjustedEstimate`. Route volá obě AI funkce paralelně (Promise.all); `aiCorrection` jde do UI karty i PDF reportu (`ValuationReportData.aiCorrection?` — staré sessionStorage reporty bez pole zůstávají funkční). Prompt explicitně zakazuje řídit se instrukcemi v polích z inzerátů (injection). Bez GEMINI_API_KEY / selhání → null, odhad zůstává statistický.
- **Dopravní vrstva (Vlak Index)**: `poi.ts` `fetchTransportPoiDistances` (mediány metro/vlak/bus z reálných sreality POI per čtvrť/město, NONE=100000), `transport.ts` `getTransportDistancesForValuation` (čtvrť z sreality detail URL / Nominatim + quarter-map → fallback město; cache `transport:dist:*` TTL 24 h; chybějící data → **null**, nikdy skóre 0, jinak by engine tiše srazil −6 %). `transportMultiplier` v engine.ts (skóre 0–100 → ×0,94–1,06 lineární kolem 50), +4 confidence, metodika. UI badge + PDF sekce „Doprava — Vlak Index".
- **Párování na realizované prodeje** (Phase 39): tabulka `realized_sales` (PK = property.id, FK cascade, `soldAt` = potvrzené odstranění). `sold-pairing.ts` — čistá `toRealizedSale()` (validace price>0, area>0, Kč/m² 5 000–500 000 počítané z price/area), TTL 12 měsíců. `orchestrator.ts` `sweepRemovedListings` páruje zmizelé inzeráty (insert s PK=property.id, catch duplicity — jiné chyby loguje); reaktivace vráceného inzerátu i relist **maže párování** (nebyl prodán). `market-price-service.ts` `fetchComparableSamples` přidává realizované prodeje (posledních 12 měsíců, limit 500, filtr TTL v JS kvůli testovatelnosti) — dostávají se i do Tier 1 tržních rozmezí (skutečné transakce > nabídky). Engine: komparace z vlastní historie mají `source: "realized"` + `soldAt` → UI „prodej · měs. rok". Migrace: `scripts/migrate-realized-sales.ts` + `0021_realized_sales.sql`.
- **Odhad jen byty** (Phase 48): formulář bez výběru typu (statický badge „Byt"), route rejectuje dům/pozemek při URL parse (400, flat-precendence v `inferType` — „bytový dům"/„panelový dům" v titulu bytu nesmí rejectnout), engine má defenzivní `isFlat` gate.
- **Autocomplete adresy s GPS** (Phase 42): `suggestAddresses` (geocode.ts, Nominatim jsonv2, countrycodes=cz, cache 6 h) + `GET /api/geocode/suggest` + `AddressAutocomplete` (debounce 350 ms, klávesy, ARIA). Výběr uloží adresu + lat/lng + wardHints; ruční editace adresy zneplatní GPS i hinty; `input.wardHints` má přednost před reverse geokódem. Badge „Přesné GPS určeno".
- **Adresní transakce z cenové mapy** (Phase 44–45): `fetchWardTransactions(cityKey, ctx)` — veřejné API `estate_list` per ward vrací transakce s GPS, č.p., velikostní kategorií („Byt, 66–70 m²"), datem a transaction_id, ale **BEZ ceny** (ČÚZK anonymizuje → ani Valuo nemá adresní ceny, používá hedonic model). Napojeno do engine jako komparace: řádky „Žižkov 1291 · prodej · 07/2026 · 0,08 km", filtr okruh 10 km + plocha ±30 % (`parseAreaCategory`), cap 5, `ComparableRow.pricePerSqm` nullable (transakce bez ceny → UI „—").
- Diagnostika: `scripts/valuation-check.ts` (determinismus), `scripts/valuation-verify-tx.ts` (adresní transakce), `scripts/valuation-debug.ts` / `scripts/valuation-debug-zizkov.ts` (krok-za-krokem replika engine pro konkrétní lokalitu).

## Key Files
- `src/lib/analysis/flip-costs.ts` — flip calculator (no VAT, tax fixed 21%)
- `src/lib/analysis/rental-calc.ts` — rental calculator (cap rate = NOI ÷ price, yield on investment = NOI ÷ (price+acq), daň 15 % s paušálem 30 % cap 600k, geometric annualized ROI, DSCR, verdict relativní k `targetYield`: +1.5/+0/−1)
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
- `src/lib/scraping/property-match.ts` — alt_portals dedup (`parseAltPortals`, `appendAltPortal`, `hasAltUrl`, `toDbAltPortals`)
- `src/components/auth/login-splash.tsx` — splash animace při přihlášení
- `src/components/ui/properties-explorer.tsx` — řazení 9 režimů + odnímatelné filtry
- `src/components/ui/property-card.tsx` — mini-carousel fotek na kartách
- `src/components/ui/image-gallery.tsx` — galerie s klávesovými šipkami + velkými klikacími zónami (detail + lead drawer)

## Scraper Architecture
- `crawlAll` runs all portals **in parallel** (Promise.allSettled).
- Stale deactivation: bulk `UPDATE ... WHERE NOT IN` (was N+1).
- `crawlSearch`: stale deactivation pro inzeráty, které zmizely a nemají link na jiné hledání (nagromaděné "aktivní mrtvoly" z minulých full-portal crawlů).
- Re-analysis only on price change (was every crawl).
- `saveListing` passes `listing.portalName` to `filterImages` (was missing).
- All adapters call `enrichListing()` in `crawlListings()`.
- Čištění non-target měst: `npx tsx scripts/cleanup-orphans.ts` (dry-run) / `--delete` (maže mimo zadaná města, backup JSON do `scripts/`).
- **Sale-only filtr**: `isSaleListing()` v `src/lib/scraping/filters.ts` — odmítá nákupní poptávky (koupím/koupí/poptávka/hledáme byt/nabídněte) a nájmy (pronájem, podnájem). Hlavní signály z titulku/adresy/URL; v popisu jen jednoznačné nájemní formulace (marketingové zmínky typu "možnost pronájmu"/"poptávka" prodej nebudou). Napojeno: `orchestrator.saveListing` + `crawlSearch/crawlAll` filtr + `POST /api/properties/create-from-url` (400) + `POST /api/analyze-url`. Vyčištění prod: `npx tsx scripts/purge-nonsale.ts` (dry-run) / `--delete`.
- **Area resolver** (`src/lib/scraping/area-resolver.ts`): `resolveLivingArea(floorArea, usableArea)` — rozdíl > 15 % → menší plocha + `accessoryArea` (rozdíl = odhad terasy/balkonu/sklepu); ≤ 15 % → podlahová plocha; jen jedna → ta; menší < 15 m² → `invalid-small` (použít větší); poměr > 5× → `extreme-diff` (manuální kontrola). `applyAreaResolution()` volán v `orchestrator.saveListing` (jen nové/budoucí inzeráty), `POST /api/properties/create-from-url`, `POST /api/analyze-url`. Sreality + realitymat vyplňují `floorArea`/`usableArea`, idnes-reality užitnou plochu. DB sloupce `floor_area`/`usable_area`/`accessory_area`/`area_flag` (PG+SQLite, migrace `0009_area_resolution.sql` + `scripts/migrate-area-resolution.ts`). UI: badge "⚠ kontrola"/"plocha podezřelá" + "+X m² příslušenství" v `EditableArea`.

## Common Tasks
- Add portal: implement adapter in `src/lib/scraping/adapters/` → register in both trigger routes + url-scraper.
- Run tests: `npm test`.
- Build: `npx next build`.
- Run Python scraper locally: `$env:VYKUPY_API_TOKEN="..." ; $env:VYKUPY_API_URL="..." ; python scripts/drazby_hunter.py`

## Pipeline (Leads CRM)
- Route `/leads` (client `LeadsBoard`), 7 fází v `src/lib/leads.ts` (`LEAD_STAGES`, barevné tečky `dot`).
- Komponenty `src/components/leads/`: `leads-board.tsx` (DndContext + SortableContext + DragOverlay + **StageColumn s useDroppable** — přetažení funguje i na prázdné stádium; `boardCollision` = pointerWithin karty → sloupce → closestCorners; insert lines; **drag preview = věrná kopie karty**), `lead-card.tsx`, `lead-drawer.tsx` (**rozdělen na `LeadDrawer` + `LeadDrawerContent` keyed per lead.id** — jinak stale-state; slide-over, PATCH stage/priority/notes/stageData, převod na deal z `closed`), `leads-toolbar.tsx` (search/filter/sort), `types.ts` (`LeadItem` + `StageData`).
- **Potvrzení vyjednané ceny na kartě** (`lead-card.tsx`): prompt používá `AmountInput` (živé formátování mezer + tolerantní parser `parseAmountInput`; mezery/NBSP/Kč odfiltruje) — `<input type="number">` + `Number()` tiše selhávalo na česky formátovaných cenách („2 500 000" → prázdný value → fajfka nedělala nic). Neplatný vstup (0) ukáže nápovědu. Stejné parsování (`parsePriceInput`) + `AmountInput` má i pole „Vyjednaná cena"/nabídnutá cena v lead-draweru.
- **Karta (kompaktní, bez nepotřebných dat)**: nadpis + skóre + hvězdička priority; **poloha = `splitAddress()`** (utils.ts: ulice = první segment, město = zbytek — zvládá i `Brno, 614 00` / `Vašátkova 16 Praha`), ulice + město na dvou řádcích, **nikdy se neřeže**; cena + **cena/m²** v cenovém řádku; na hover se v cenovém řádku rozbalí akce **posunout/ztraceno** (w-0→w-auto animace, v úzkém sloupci nic nepřetéká); poznámka **celá** (bez line-clamp); stage chips (📅/💰/🤝), AgingBadge „X dní", „Krok propadl", „Deal". **Není na kartě**: CÍL, ARV, stav, typ budovy, kontakt, relativní čas, „na trhu", badge m²/dispozice (jsou v nadpisu).
- **Hlavička sloupce**: tečka + název + počet + progress bar + červený chip „N overdue" (KPI „X celkem" / „Ø dní" byly odebrány).
- **Sloupce**: `flex-1 basis-0 min-w-[160px] lg:min-w-0` — na desktopu se všech 7 vejde bez horizontálního scrollu, na mobilu scroll; @container na sloupci (žádné `@max-[240px]` skrývání obsahu karty).
- **Stage-specific data** (`leads.stage_data`, SQLite text / Neon jsonb): fáze Schůzka (datum/lokalita), Nabídka (cena + historie, předvyplnění z `analysisTargetPurchasePrice`), Vyjednávání (částka + historie my/oni). Badge 📅/💰 na kartě. Call Mode panel "Nadcházející schůzky" (leady ve fázi meeting s datem).
- `GET /api/leads` zobrazuje kontakt z properties (coalesce) + `propertyImageUrl` + **`propertyImageUrls`** (celé pole fotek — detail v draweru používá `ImageGallery` s listováním) + `analysisTargetPurchasePrice`/`analysisArv`.
- Initiate dedup kontaktů: **phone + name** (ne jen phone) v `src/app/api/properties/[id]/initiate/route.ts`.

## Investoři (Investor DB)
- Route `/investors` (seznam karet) + `/investors/[id]` (detail: kontakt, budget, projekty). Menu položka "Investoři" (HandCoins) mezi Kontakty a Portfolio.
- DB `investors` (SQLite `src/db/schema/investors.ts` + PG `src/db/pg/investors.ts`): id, name, city, phone, email, budget (integer Kč), budgetUnlimited (0/1), portalEnabled (0/1), portalPasswordHash (bcrypt), notes, createdAt/updatedAt. Migrace `0008_investors.sql` (PG ručně SQL) + `0013_investor_portal.sql`.
- `deals.investor_id` → investors.id (FK set null). **null = "Sám financuji"** (self-funded).
- API: `GET/POST /api/investors`, `GET/PATCH/DELETE /api/investors/[id]`, `PATCH /api/deals/[id]` (změna investora).
- Výběr investora při převodu leadu → deal (`/api/leads/[id]/convert` + select v lead-drawer; výchozí "Sám financuji"). Portfolio karta + detail zobrazují investora (badge / karta s budgetem + `InvestorSelector`).
- `src/lib/investors.ts`: `formatInvestorBudget` (Neomezeno / mil./tis. Kč / Neuveden), `budgetCovers`.
- **Investorský portál** (`/investor`, client pages mimo `(dashboard)`): vlastní HMAC cookie session (`src/lib/investor-session.ts`, NEPOUŽÍVÁ NextAuth — investoři nesmí do dashboardu). Přihlášení jménem + heslem (`investors.portal_enabled` / `portal_password_hash` bcrypt). API `/api/investor-portal/login|logout|properties|reserve`. Bílá listina polí dána v `src/lib/investor-portal-view.ts` — nikdy adresa/fotky/GPS/URL/kontakt; zisk z `leads.stage === "negotiation"` + `portal_visible=1`; „navržená cena" = `stageData.negotiation.currentAmount` fallback `targetPurchasePrice`. Rezervace: `leads.portal_status` (`available`/`reserved`) + `leads.portal_reserved_investor_id` FK investors. **Rezervace drží 72 h** (`PORTAL_RESERVATION_MS`, sloupce `leads.portal_reserved_at` / `portal_expires_at`, nastavované při rezervaci + při admin přiřazení). **Model spolupráce**: `investors.preferred_model` (preference investora) a `leads.portal_reserved_model` (dohodnutý model pro danou nabídku) — hodnoty `flip`/`rent`/`both` dle `COOPERATION_MODELS` v `src/lib/portal-reservation.ts`. Expirace: `expireStaleReservations()` běží při načtení portálu (`listPortalItems`) — prošlá rezervace se uvolní zpět na „Dostupná". Jméno rezervujícího investora se ostatním ukazuje jen jako iniciály (`investorInitials` v `investor-portal-view.ts`, např. „G.S.") — i v e-mailových nabídkách. Admin: panel `src/components/leads/portal-panel.tsx` na detailu nemovitosti, portal sekce v `investor-modal.tsx`, PATCH `/api/leads/[id]/portal`, PATCH/POST `/api/investors*` (bcrypt hash). Detail nemovitosti v portálu (`DealDetail`) zobrazuje detailní položkový rozpad výpočtu z kalkulačky pro flip i nájemní nemovitosti na základě snapshotu z preset API (složky nákladů, poplatky, daně, NOI, cash-on-cash atd.), a neobsahuje řádek "ROI p.a.". Badge typu (FLIP/NAJEM) na kartě = `ModeBadge` — plné pozadí `bg-accent` (zelená) / `bg-info` (modrá) s bílým textem. Migrace `scripts/migrate-portal-reservation.ts` (SQLite + Neon direct non-pooler, `0023_portal_reservation.sql`).
- **E-mail s novou nabídkou** (`src/lib/email/offer-template.ts`, odesílá `notifyInvestorsOfOffer` při fázi Vyjednáno): ceny přesně jako v DB (`formatPrice`, ne `formatCompactPrice`); bez řádku „ROI (ročně)"; „Způsob spolupráce" = typ investice (FLIP/NAJEM) + řádek „Model" (50/50 / Sourcing fee / 50/50 nebo Sourcing fee — velké S, jeden řádek). Patička bez „Chcete-li odhlášení".

## Lokalitní inteligence (Locality Intelligence)
- Modul `src/lib/locality/`: reálná data z ČSÚ, PČR a sreality. **Žádná vymyšlená čísla — chybějící data = null/0, nikdy odhad.**
- **Nezaměstnanost** (`czso.ts`): ČSÚ NKOD DCAT, dataset **2023** (Iri `b5c4d539...`), `cityKeyForMunicipality` = přesná shoda názvu (ne substring — "Plzeň-sever" se nemapuje na plzen). URL se řeší dynamicky přes NKOD.
- **Migrace/obyvatel** (`czso.ts`): ČSÚ 2024 (`DEM0001` migrace, `DEM0026B` obyvatel), největší obec s názvem = skutečné město.
- **SLDB 2021 + firmy** (`sldb.ts`): ČSÚ věková struktura per ORP (podíl 65+, SLDB 2021) + počet ekonomických subjektů per obec (RES, Q4 2025). Cache 24 h v `locality_metrics` (source `czso-sldb`/`czso-firms`). ZIP EOCD parser (data descriptors), detekce UTF-8/cp1250.
- **Kriminalita** (`crime.ts`): **PČR XLSX statistiky** (prosinec 2025), per kraj → index TČ/100k, cache 30 dní v `locality_metrics` (source `pcr-crime`). NIKDY statická mapa. **Auto-refresh**: `discoverLatestCrimeSource()` najde nejnovější měsíční XLSX ze stránky aktuálního roku (`soubor/{rok}-{měsíc}-*-sest-01a-xlsx.aspx`), fallback 3 roky zpět + hardcoded.
- **POI/Walkability** (`poi.ts`): **sreality API** medián vzdáleností k POI (`poi_*_distance`) — NE Overpass (nestabilní 406/timeout). Cache v `rents` (segment `poi:quarter:{id}` per čtvrť, nebo `poi` per město), sloupce `walkability`+`counts_json`, min 3 vzorky.
  - **Priorita POI**: 1) sreality detail (`sreality-detail.ts` z `properties.url` hash_id) → `quarter_id`+`district_id`+GPS ulice → POI per čtvrť; 2) Nominatim reverse-geocode GPS → `quarter-map.ts` (čtvrť → quarter_id) → POI per čtvrť; 3) městský průměr.
  - `locality_quarter_id` v sreality search je nespolehlivý napříč městy → kombinace `locality_district_id` (okres) + filtr názvu čtvrti v kódu. Diakritika normalizovaná (`normalizeCity`).
- **Renta** (`rent.ts` + `scraping/rent-scraper.ts`): sreality nájmy (`category_type_cb=2`), **min 5 vzorků** jinak null (žádný fallback 0,5 %).
- **Doprava** (`transport.ts`): sreality `poi_metro/train/bus_distance`, transport skóre (`scoreTransportDistance` v score.ts), prémie cena/m² vs dostupnost (korelace).
- **Cenový index** (`src/lib/market/price-index.ts`): IQR outliery, robustní medián base, min 5 vzorků per segment, segmenty <5 skryté v UI.
- **AI dohled** (`src/lib/ai/locality-guard.ts`): Gemini sanity-check POUZE pro podezřelá data (`needsLocalityGuard`), prompt zakazuje vymýšlet, verdikt v `propertyAnalysis.aiLocalityVerdict` + badge v UI.

## DB — locality tabulky
- `locality_metrics` PK `(city_key, source, period)`, `json_data`, `fetched_at`.
- `rents` PK `(city_key, segment)` — segmenty: `any` (nájmy), `transport` (prémie), `poi` (walkability město), `poi:quarter:{id}` (walkability čtvrť). Sloupce navíc `walkability`, `counts_json`.
- `propertyAnalysis` + `localityScore`, `localityFactorsJson`, `aiLocalityVerdict` (ALTER na Neon manuálně).

## Mapy a geokódování
- `PropertyMap` (`src/components/ui/property-map.tsx`): Leaflet + OSM tiles. Když nemovitost nemá GPS → volá `POST /api/geocode` → Nominatim → uloží lat/lng do `properties` (cache), mezitím "Načítám polohu…". Fallback při selhání: text adresy.
- `src/lib/geocode.ts`: `geocodeAddress(address, cityKey)` (adresa+město → Nominatim, fallback jen město), `cityKeyToName`, `reverseGeocode(lat,lng)` → suburb/city (pro POI čtvrť).
- Nominatim vyžaduje `User-Agent`; adresa "Lesní, Cheb" geokóduje správně (Pelhřimov = čtvrť Chebu). Reverse-geocode extrahuje čtvrť z display_name (přesnější než suburb).

## Trh (Market) — investiční nástroje
- `src/app/(dashboard)/market/page.tsx` server komponenta: agregace nabídkových cen + `LocalityMarkets` (tabulka lokalit se skóre), `PriceIndexCard` (cenový index, `/api/market/price-index`), `BuyVsRentCalculator` (30letá simulace koupě vs nájem).
- `LocalityProfile` v detailu nemovitosti (`/properties/[id]` sidebar): 6 dimenzí (ekonomika, demografie, vybavenost, doprava, bezpečnost, rentový výnos) + AI badge.

## Scraper notes (nové)
- Rent scraper `src/lib/scraping/rent-scraper.ts` — ceny z `price_czk_m2`/`price_czk`, plocha z názvu.
- Transport scraper v `transport.ts` — `poi_*_distance` z sreality search API.
- Refresh: `scripts/refresh-locality.ts` (ČSÚ + renty + transport + POI per city) — musí importovat `./_env` PŘED db (tsx skripty nemají Next env).
