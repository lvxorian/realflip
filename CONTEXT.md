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
- **Testing**: Vitest v4 + jsdom + @testing-library/react (738 tests, 60 files)

## Infrastructure
- **DB**: Neon PostgreSQL + `data.db` (SQLite fallback)
- **Test account**: `cakmak@tuta.com` / `realflip2026`
- **Deploy**: Vercel + Neon (Hobby plan, 1 cron/day)
- **Cron (vše 1×/den, Vercel Hobby limit)**: `vercel.json` — scraping 6:00 (`/api/scraping/trigger`), deska 8:00 (`/api/deska/poll`), isir 6:00 (`/api/isir/cron`), ares 9:00 (`/api/ares/cron`), realingo 11:00 (`/api/realingo/cron`). Cron route auth: `Authorization: Bearer CRON_SECRET`.
- **GitHub Actions 6:00 UTC**: `daily-scraper.yml` (Radar Refresh → `/api/market/radar-refresh`, `x-cron-secret`) + `drazby-hunter.yml` (Portál dražeb)

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
- ISIR Hunter removed in Phase 10 (written off as "not publicly accessible") — **POZNÁMKA**: znovu vybudovaný v Phase 81, ISIR SOAP API je dostupné na `isir.justice.cz:8443/isir_public_ws/`.

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
- Cenový index (orientační, označené).
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

### Phase 27 — Remaining položky (Done)
- **Bezrealitky perf**: skip detail fetch pro search listingy s kompletními daty (Apollo cache už obsahuje plná advert data) — run už nehrozí timeoutem na Vercelu.
- **parse-auction**: `maxDuration = 60` (JSON+PDF+Gemini pipeline), dokumentace = reálná pipeline (ne mock).
- **`checkScoreThresholdAlert`**: nový alert typ (minScore z rules), volaný z orchestratoru při novém listingu i re-analýze.
- **`target_roi` integer→real**: schema (SQLite+PG) + manuální migrace `0007_target_roi_real.sql`.
- **iDnes `yearBuilt`**: url-scraper čte `rok kolaudace/výstavby` param + fallback z popisu.
- **Kriminalita auto-refresh**: `discoverLatestCrimeSource()` najde nejnovější PČR XLSX ze stránky aktuálního roku (fallback 3 roky + hardcoded).
- **Renta malá města**: `locality_district_cz` filtr (sreality API) + fallback celá ČR, MAX_PAGES 5.
- **SLDB 2021 + firmy**: `sldb.ts` — věková struktura per ORP (podíl 65+) + ČSÚ RES firmy per obec (reálná data, dřív null). Robustní ZIP EOCD parser (data descriptors), detekce UTF-8/cp1250.
- **Quarter-map**: reálné sreality district_id per město (Praha per správní obvod 5001-5010; Brno 72, Ostrava 65, Ústí 27, Olomouc 42, KV 10, Cheb 9, Plzeň 12, Liberec 22, Pardubice 32, Hradec 28, Zlín 38, Jihlava 67, ČB 1) — POI quarter filtr vrací výsledky (staré ID vracely 0). + nová města.
- **Nominatim reverse-geocode**: čtvrť extrahovaná z display_name ("Plzeň 3") místo vágního suburb ("Severní Předměstí"), fallback na suburb.

## Remaining
- Neon nemá `__drizzle_migrations` — nové migrace aplikovat ručně SQL (`drizzle-kit push` blokuje interactive prompts).
- hyperreality (doména = GitLab login), century21 (429 bot protection) — bez adapteru, `enabled: false`.
- Remax detail (kontakt/plocha) je Vue-renderovaný — data se berou ze search stránky (data-* atributy); případně doplnit kontakt přes API.
- **Vercel Hobby**: cron limity — MAX 1×/den (scraping 6:00, deska 8:00, isir 6:00 sdílené... pozor: `0 */6 * * *` blokuje deploy → všechny crony musí být 1×/den nebo odstraněné). ISIR běží jen 1×/den (feed iterace je pomalá, 2,5 s/ID).
- **ISIR cron MANUÁLNÍ spuštění**: `GET /api/isir/cron` s `Authorization: Bearer {CRON_SECRET}`.
- AI guard: při 503 (Gemini high demand) tichý fallback na null (bez badge) — chování zachováno, retry neuvedeno.
- `realflip animace 2.mov` (13,6 MB zdroj splash videa) je untracked — finální `public/realflip-animation.mp4` (1,8 MB) je v repu; zdroj případně přidat do `.gitignore`.

### Phase 28 — Investoři (Done)
- **Sekce INVESTORI** (`/investors` + `/investors/[id]`), menu položka mezi Kontakty a Portfolio.
- **DB `investors`**: jméno, město bydliště, telefon, email, budget (Kč) + **Neomezeno** (budgetUnlimited flag). `deals.investor_id` FK → investors (set null) — **null = "Sám financuji"** (self-funded).
- **API**: `GET/POST /api/investors`, `GET/PATCH/DELETE /api/investors/[id]`, `PATCH /api/deals/[id]` (změna investora na projektu).
- **UI**: seznam karet (avatar, kontakt, budget badge) + `InvestorModal` (přidat/upravit/smazat, přepínač Neomezeno) + detail stránka (kontakt, budget, tabulka projektů investora).
- **Propojení**: výběr investora při převodu leadu → deal (lead-drawer select, default "Sám financuji"). Portfolio karta ukazuje badge investora, detail projektu má kartu "Investor / financování" s `InvestorSelector` (změna financování).
- **Pomocné fce** `src/lib/investors.ts`: `formatInvestorBudget` (Neomezeno/mil./tis./Neuveden), `budgetCovers`.
- **Migrace**: `0008_investors.sql` (PG ručně SQL) + SQLite ALTER (data.db). **Aplikováno na Neon** — investors tabulka, `deals.investor_id` + FK set null ověřeny.
- **Testy**: `src/lib/__tests__/investors.test.ts` (9) — celkem **255 testů / 21 souborů**.

### Phase 29 — Editovatelný stav + žhavý přepočet (Done)
- **Globální štítky stavů** v `CONDITION_LABELS` (`src/lib/utils.ts`): unified → `new: Novostavba`, `renovated: Po rekonstrukci`, `good: Průměrný`, `original: Před rekonstrukcí`, `dilapidated: Neobyvatelný`, `project: Projekt`. Staré názvy ("Dobrý"/"Původní"/"Zchátralý") testy `utils.test.ts` upraveny.
- **`EditableCondition`** (`src/components/properties/editable-condition.tsx`): tužka → inline `<select>` (5 stavy, Enter uloží / Esc zavře) → `PATCH { condition }` + toast + `router.refresh()`. Vzorem `EditableArea`.
- **Detail** (`properties/[id]/page.tsx`): "stav" vytažen ze statického pole dispozice/patro/rok do vlastního boxu s `EditableCondition` (vedle "velikost"), `conditionLabel` import už nepoužit.
- **`PATCH /api/properties/[id]`**: validace `condition` ∈ 5 hodnot (jinak 400), `.set({ condition })`. Při změně stavu **žhavý přepočet** — `getAnalysisRanges({ cityKey, lat, lng, condition: new, buildingType, area, category })` (jen když `locationCity` známá a ≠ "Neznámá"), čerstvé `dynamicRange`/`arvRange` + `marketSource`/`marketSampleSize`; při selhání fallback na uložené range (offline re-analysis).
- **Testy/typy/build**: 290 testů / 22 souborů zelené, `tsc --noEmit` čistý, `next build` OK.

### Phase 30 — Investor portal polish (Done)
- Fixed Brickon investor portal list in `src/app/investor/(portal)/page.tsx`: key metric cell values no longer wrap, locality labels use `capitalize`, and ROI now prefers `propertyAnalysis.rentalYield` when available.
- Backend selection updated in `src/lib/investor-portal.ts` to include `propertyAnalysis.rentalYield`; mapping updated in `src/lib/investor-portal-view.ts`.
- Verified with `npx tsc --noEmit` and `npx next build`.

### Phase 31 — Investor Portal Itemized Breakdown (Done)
- **Rozpis položek v portálu**: Přidán položkový rozpad výpočtu z kalkulačky pro flip i nájemní nemovitosti v klientském portálu pro investory (`src/app/investor/(portal)/page.tsx`).
- **Nové snapshot položky**: API routa `/api/properties/[id]/calc-preset` a view typy v `src/lib/investor-portal-view.ts` rozšířeny o položky `legalFees`, `appraisalFee`, `contingency`, `holdingCosts`, `sellingCommission`, `marketingPhoto`, `mortgageCost`, `sourcingFee`, `incomeTax`, `noiAnnual`, `cashOnCash`, atd.
- **Odstranění ROI p.a.**: Z detailu v portálu byl odstraněn řádek "ROI p.a.".
- **Verifikace**: `npx tsc --noEmit` a `npm run build` prošly bez chyb.

### Phase 32 — Odhad ceny nemovitosti (Done)
- **Nový modul „Odhad"** (`/odhad` v menu, ikona Scales, mezi Kalkulačkou a Hledáním) — automatické ocenění nemovitosti z URL inzerátu (sreality, realitymat, reality.idnes.cz, bazos, bezrealitky…) nebo ručního formuláře s editačními poli.
- **Zdroje (kaskáda)**: 1) **Realizované prodeje** — Seznam cenová mapa (`sreality.cz/cenova-mapa`, SSR parse) — **50 469 transakcí**, průměr Kč/m² per kraj (14), posledních 12 měsíců, ČÚZK data; cache 7 dní v `market_cache` (source `price_map`, city `cz`). 2) **Nabídkové kompy** — stávající kaskáda Tier 1–5 (`getPropertyMarketRange`). 3) **ČSÚ index cen bytů** — reálný snapshot (`czso-trend.ts`, 014008-26). Reas.cz záměrně vynechán (email v wizardu + ToS).
- **Engine** (`src/lib/valuation/engine.ts`): vážený blend realizovaných (45 %) + nabídek (35 %), úprava plochy (elasticita 0,1, clamp 0,85–1,15), multiplikátory stav/typ/kategorie, rozmezí = odhad ± spread z kvality dat, **confidence 0–100** (Vysoká/Střední/Nízká), srovnatelné nabídky (GPS ≤ 10 km, plocha ± 30 %, dedup adres).
- **AI vrstva** (`ai.ts`): Gemini vysvětlí odhad česky (JSON, teplota 0.2, **NESMÍ vymýšlet čísla** — vzor locality-guard), selhání → null.
- **API**: `POST /api/valuation` — fáze 1 (jen URL → data inzerátu k úpravě) + fáze 2 (ocenění + AI + trend cenové mapy).
- **UI**: `/odhad` (URL input → editační formulář → výsledek: hero rozmezí s range barem + bodový odhad, zdroje s vahami, tabulka srovnatelných, trend graf (recharts), AI hodnocení, metodika, disclaimer). **PDF report** `/report/valuation` (sessionStorage `valuation-report`, tisk jako auction report).
- **Diagnostika**: `scripts/valuation-check.ts` (live kontrola realizovaných cen per kraj).
- **Testy**: `src/lib/valuation/__tests__/engine.test.ts` (8, injectované deps) — celkem **393 testů / 32 souborů**.

### Phase 33 — Odhad: oprava relevance komparací (Done)
- **Bug**: komparace u malých měst (Cheb) obsahovaly inzeráty z jiných měst (Praha) — vzorek bez GPS prošel lokálním filtrem bez kontroly, protože podmínka vzdálenosti se aplikovala jen na vzorky s GPS.
- **Oprava** (`engine.ts`): pokud cíl nebo vzorek nemá GPS → kontrola proběhne přes adresu města (nová `addressContainsCity` s word-boundary regexem — nechytá falešné shody typu „u mostu" pro město Most).
- **Reálná data pro malá města**: `CITY_TO_REGION` v `locality/crime.ts` rozšířeno z 13 na ~50 měst (cheb→karlovarsky, kladno→stredocesky, trutnov→kralovehradecky…). Bez mapování vracel `regionKeyForCity` null → realizované prodeje z cenové mapy (ČÚZK) pro tato města vůbec nefungovaly.
- **Váhy zdrojů podle kvality**: db/sreality = plná váha, market_data = 0,6×, fallback (celoČR) = 0,3× — Cheb už nedostane ceny Prahy/ČR jako městskou hladinu; labely zdrojů to transparentně říkají („ČR (fallback)").
- **UI**: hero + range bar + PDF report nyní ukazují **Kč/m² pod min / mediánem / maxem** (jako Valuo) — `lowPerSqm` / `pricePerSqm` / `highPerSqm`.
- **Živě ověřeno** (`scripts/valuation-check.ts`): Cheb → Karlovarský kraj, realizované 42 181 Kč/m² (2 420 transakcí), odhad 3,13 mil. Kč, **14 komparací, všechny z Chebu, 0 z cizích měst**.
- **Testy**: regresní lokalitní testy (Cheb vs Praha s/bez GPS) + váhy fallbacku + CITY_TO_REGION — celkem **397 testů / 32 souborů**.

### Phase 34 — Odhad: městská úroveň realizovaných cen + propojení (Done)
- **Drill-down cenové mapy na město** (`price-map.ts`): nalezeno veřejné API `GET /api/v1/price_map/list?category_main_cb=1&date_from=YYYY-MM&date_to=YYYY-MM&locality=<entity_type>,<entity_id>` — hierarchie country → region → district → municipality. Nová `getRealizedLocalityForCity` vrací **nejpřesnější úroveň (obec > okres > kraj)** + kontext vyšších úrovní; cache 7 dní v `market_cache` (segmenty `price_map_district`/`price_map_municipality`, klíč `region,<id>`/`district,<id>`). Stará SSR cache bez entityId se automaticky obnoví.
- **Engine** (`engine.ts`): zdroj realizovaných nyní nese label dle úrovně („Realizované prodeje — Cheb" / „— okres" / „— kraj") a komparace ukazují město → okres → kraj jako kontext (3 řádky realized). Živě ověřeno: Cheb 46 768 Kč/m² (251 tx) místo krajských 42 181.
- **Tabulka srovnatelných** (UI + PDF): nový sloupec **„Odhad"** — poměr Kč/m² komp vs. medián odhadu (± %), zvýraznění outliers (< 75 % / > 130 %) jantarovým podbarvením.
- **Propojení**: `/odhad?url=…` předvyplní URL a automaticky načte inzerát (useSearchParams + Suspense dle konvence login page; čeká na ověřenou session). Tlačítko/odkaz **„Odhad ceny"** v detailu nemovitosti (`properties/[id]`) i v kartě Analyzátoru (`interactive-analysis.tsx`).
- **Testy**: `price-map.test.ts` (5, mock fetch — drill-down, fallback okres, neznámé město, okno), engine testy pro městskou úroveň — celkem **404 testů / 33 souborů**.

### Phase 35 — Odhad: čtvrťová úroveň + přesná adresa (Done)
- **Ward-level realizované ceny** (`price-map.ts`): Praha (region → rovnou **čtvrti/wardy**, např. **Žižkov 160 324 Kč/m² / 743 tx** vs. kraj 149 906), ostatní města obec → čtvrť. `getRealizedLocalityForCity(cityKey, ctx)` — ctx nese `address/lat/lng/wardHints`; `findWardByHints` matchuje čtvrť z reverse geokódu Nominatimu (quarter/suburb) a segmentů adresy (seoName → jméno → substring). Bez adresy Praha zůstává na krajské úrovni (čtvrť by byla náhodná). Typy: `RealizedLevel` + `ward*` pole v `RealizedLocality`, `wardHints` v `ValuationInput`.
- **Adresa povinná + geokódování** (`route.ts`): validace adresy; chybí-li GPS, `geocodeAddress` (Nominatim) → lat/lng; `reverseGeocode` → wardHints. Předává se do engine → čtvrť + kompy v okruhu. UI (`valuation-input.tsx`): adresa povinná s nápovědou (čtvrťová přesnost).
- **Engine robustnost** (`engine.ts`): váha nabídek dle počtu vzorků (`min(sampleSize,8)/8`), clamp nabídek do pásma [0,75×; 1,35×] realizovaných (+„nesoulad" → širší spread), **partial pooling** — čtvrť/obec nad krajem o >35 % se stáhne ke krajské hladině (novostavby), **srážka za skladbu fondu ×0,94 pro „good"** (průměr čtvrti tlačí novostavby/renovované nad úroveň běžného stavu). Spread 0,05–0,18 (čtvrť ±5–8 % jako Valuo), komparace realizovaných = čtvrť → obec → okres → kraj.
- **DB kompy bez novostaveb** (`market-price-service.ts`): Tier 1 nyní vylučuje `condition === "new"` a u segmentu „any" aplikuje multiplikátory stavu/typu/kategorie (konzistence s Tier sreality) — medián Prahy klesl z 181k na 163k Kč/m². (Pozn.: ovlivňuje i flip kalkulačku — sdílená kaskáda, záměrně.)
- **AI** (`ai.ts`): do promptu přidána adresa. Živě ověřeno (skript `valuation-check.ts`): Žižkov ward 160 324 Kč/m² (743 tx), byt K Lučinám 73 m² „průměrný" → odhad **11,17 mil. Kč** (153 025 Kč/m², rozmezí 10,0–12,34, ±11 %, confidence 91). Čistý testovací scénář (shrink + srážka) sedí na 9,58 mil. — blízko Valuo 9,375 mil.; zbývající odchylka živých dat = agregátní úroveň čtvrti/města vs. adresní hedonic model Valuo (mikro-poloha K Lučinám u Malešic je levnější než jádro Žižkova).
- **Testy**: price-map (ward drill Praha s adresou/hinty, bez adresy → kraj), engine (ward label/shrink/mix-skew, 4 kontextové řádky, předání ctx) — celkem **410 testů / 33 souborů**.

### Phase 36 — Odhad: stabilita výsledků (Done)
- **Problém**: stejný byt (K Lučinám) dával napříč runy 8,3M / 11,2M / 12,1M — uživatel dostal regionální hladinu 112 430, ač stránka už vrací 149 906 (zastaralá 7denní DB cache v produkci).
- **Opravy** (`price-map.ts`): TTL region cache 7 dní → **1 den**; `readCache`/drill čtení s `orderBy(fetchedAt desc)`; **plausibilita region listu** (prázdný/korupovaný/bez entityId → čerstvý fetch); **retry (2×)** na SSR fetch i drill API; drill cache vyžaduje neprázdný list.
- **GPS bucket v offers cache** (`market-price-service.ts`): cache klíč rozšířen o hrubé souřadnice (0,5°) — okruhové výsledky (5–10 km) nesdílí klíč s celoměstskými (nestabilita pořadí volání).
- **Engine**: používá `floor` a `yearBuilt` multiplikátory; **realističtější křivka velikosti** (exponent 0,25, clamp 0,7–1,3 — 1+kk ≈ +15 %, 4+kk ≈ −12 %); clamp nabídek zpřísněn na **±25 %** kolem realizovaných (prémiové Žižkov nabídky 203k vs. realizované 150k); **confidence cap 95** (nikdy 100 %).
- **Živě ověřeno (determinismus)**: 3× spuštění stejného bytu → identický výsledek **11,62 mil. Kč** (159 189 Kč/m², čtvrť Žižkov 150 705 po korekcích, rozmezí 10,17–13,07, ±12 %, confidence 91). Cheb regrese OK (46 768 Kč/m²).
- **Testy**: +1 (křivka velikosti) — celkem **411 testů / 33 souborů**.


### Phase 37 — Odhad: AI korekce mikro-polohy (Done)
- **`correctValuation`** (`src/lib/valuation/ai.ts`): Gemini prompt s adresou, čtvrtí (z `enriched` — lat/lng/wardHints), srovnatelnými (realizované + nabídky s odstupem km) → úprava statistického odhadu v %.
- **`sanitizeAiCorrection`** (pure funkce, 7 testů): clamp ±15 %, `typeof adjustmentPct === "number"` (odmítá null/string/bool), `adjustedPricePerSqm`/`adjustedEstimate` = base × (1+pct/100), směr up/down/neutral, faktory max 4.
- **Route**: `Promise.all([explainValuation, correctValuation(enriched, result)])` → `aiCorrection` v odpovědi; selhání AI → null (odhad statistický).
- **UI**: karta „AI korekce — mikro-poloha" (statistický vs. po korekci, delta badge, reasoning, faktory, jistota) + sekce v PDF reportu; `ValuationReportData.aiCorrection?` zpětně kompatibilní.

### Phase 38 — Odhad: dopravní vrstva (Vlak Index) (Done)
- **Data**: `poi.ts` `fetchTransportPoiDistances` — mediány metro/vlak/bus vzdáleností z reálných sreality POI inzerátů (search API `results`, NONE=100000), per čtvrť (`locality_district_id` + filtr quarter) nebo město; <3 vzorků → null.
- **Faktor**: `transport.ts` `getTransportDistancesForValuation` — rozlišení čtvrti z sreality detail URL (quarter_id) nebo Nominatim reverse geocode + `matchQuarterToSreality`; **fallback na město** při <3 vzorcích čtvrti; cache `rents` segment `transport:dist:quarter:{id}` / `transport:dist:city` TTL 24 h; **chybějící data → null, nikdy skóre 0** (stub 0 by přes `transportMultiplier(0)=0,94` tiše srazil odhad −6 %).
- **Engine**: `transportMultiplier(score)` — skóre 0–100 → ×0,94–1,06 (lineární kolem 50, clamp), aplikace na Kč/m² po areaFactor; +4 confidence (sampleSize ≥3); metodika s konkrétními vzdálenostmi + prémií města; `result.transport` pro UI.
- **AI**: `correctValuation` prompt dostává transport (vzdálenosti m + skóre + prémie) s pravidly (metro <300 m = +1..3 % atd., 100000 = stanice neexistuje).
- **UI**: badge „Doprava: Výborná · 66/100" + chips Metro/Vlak/Bus v hero kartě; PDF sekce „Doprava — Vlak Index".
- **Živě**: Praha 3 → metro 833 m / vlak 2 042 m / bus 153 m / skóre 66 (100 vzorků). Testy +5 (transportMultiplier + engine s transportem) → 423 testů / 34 souborů.

### Phase 39 — Odhad: párování inzerátů na realizované prodeje (Done)
- **Tabulka `realized_sales`** (SQLite + PG): PK = property.id (1 nemovitost = max 1 spárovaný prodej), FK cascade, cena/plocha/Kč-m²/adresa/GPS/stav, `soldAt` (potvrzené odstranění = proxy data prodeje). Migrace `scripts/migrate-realized-sales.ts` + `0021_realized_sales.sql`.
- **Párování** (`sold-pairing.ts` čistá `toRealizedSale`): validace price>0, area>0, Kč/m² 5 000–500 000 (počítané z price/area — autoritativní pole); TTL 12 měsíců. `orchestrator.ts` `sweepRemovedListings` vybírá plná data a po potvrzení odstranění (grace 7 dní) insertuje prodej; reaktivace vráceného inzerátu i relist **maže párování** (nebyl prodán).
- **Komparace** (`market-price-service.ts`): `fetchComparableSamples` přidává realizované prodeje z posledních 12 měsíců (limit 500, TTL filtr v JS pro testovatelnost) → dostávají se i do Tier 1 tržních rozmezí (skutečné transakce mají vyšší váhu než nabídky). Engine: `source: "realized"` + `soldAt` → UI „prodej · měs. rok" místo „realizované prodeje" (ČÚZK agregáty zůstávají bez data).
- **Testy +10** (sold-pairing validace, Tier 1 s realizovanými prodeji, TTL filtr, engine source realized/soldAt) → **433 testů / 35 souborů**. Code review: TTL test přes mock (where ignorován), catch u párování loguje ne-duplicitní chyby, mrtvé pricePerSqm odstraněno.

### Phase 40 — Odhad: přesnost jako Valuo + Valuo-style vstupy (Done)
- **Kalibrace na Valuo** (byt K Lučinám, Žižkov, panel, rok <1990, 73 m²): původně **111 125 Kč/m² (−14 % oproti Valuo 129 385)** — trojí penalizace panel ×0,75 · rok ×0,98 · mixSkew ×0,94 = ×0,69 z průměru čtvrti 160 324. Oprava: **panel 0,75 → 0,85** (průměr čtvrti už mix panel+cihla obsahuje — panel je ~20–25 % pod cihlou, ale vůči smíšenému průměru jen ~15 %), **mixSkew 0,94 → 0,97**. Živě ověřeno: **129 588 vs 129 385 = 0 %**.
- **Nové multiplikátory** (`market-data.ts`): `ownershipMultiplier` (družstevní 0,86 dle RE/MAX Praha −14 %), `floorMultiplier(floor, totalFloors, elevator)` (přízemí 0,93, 1. patro 0,98, podkroví 0,93–0,96, bez výtahu od 3. patra 0,90 — dle transakčních analýz −7/−9/−10–15 %), `balconyMultiplier` (+4–10 %), `gardenMultiplier` (+8–20 %), `cellarMultiplier` (+1–3 %), condition `luxury` 1,25.
- **Valuo-style vstupy** (`ValuationInput`): `ownership`, `totalFloors`, `elevator`, `balconyArea`, `gardenArea`, `cellarArea`, `lookbackMonths` (6/12/24), `asOfDate`. URL scraper (sreality) parsuje `total_floor`/`has_elevator`/`ownership`/`balcony_area`/`garden_area`/`cellar_area`.
- **Období dat** (`price-map.ts`): `priceMapWindow(months, asOfDate)`; drill API dostává `date_from/date_to` dle okna, cache segment `price_map_district_6m` (nekoliduje 6M/12M). Route: auto 6M pro `LIQUID_CITIES` (Praha, Brno…), 12M malá města, přepsatelné uživatelem.
- **Odhad k datu** (`engine.ts` `scaleToDate`): okno končí zvoleným měsícem + výsledek indexován podle trendu realizovaných cen (lineární interpolace, clamp ±40 %, ruší zastaralé `vsAskingPct`). UI: `<input type="month">`.
- **Testy +10** (nové multiplikátory, scaleToDate zpětný odhad, priceMapWindow 6/12/24 + asOf) → **443 testů / 35 souborů**. Code review: luxury label v CONDITION_LABELS, latest trend přes max ts (nezávisle na pořadí pole), period dle skutečného okna, mrtvá „teplice" odstraněna.
- **Testy**: `ai.test.ts` — celkem **418 testů / 34 souborů**.

### Phase 41 — Odhad: sladění s Valuo (Travná/Kyje + kalibrace) (Done)
- **Diagnóza**: Travná (Kyje) dával 9,77M vs. Valuo 7,88M (+24 %). Hlavní příčina: čtvrťový průměr ČÚZK (k.ú. Kyje 145 068 Kč/m², jen 29 tx/6M) je nafouknutý novostavbami/malým vzorkem — inzerát žádal 115 844 Kč/m², Valuo 102 381, sousední panelové k.ú. (Černý Most 131k, Hostivař 128k) jsou výrazně níž. Žižkov (386 tx) sedí, protože má velký důvěryhodný vzorek.
- **Bezrealitky parser**: namapováno `VERY_GOOD→renovated` (dřív null → segment „any" → kaskáda vracela odpad 204 598), `totalFloors`, `ownership` (OSOBNI/DRUZSTEVNI/PODILOVE), `lift→elevator`, balkón/terasa/loggie→balconyArea, cellarSurface→cellarArea. Uživatel už nemusí ručně doplňovat stav/patra/vlastnictví.
- **Kaskáda nabídek**: Tier 1b (10 km) dostal area filtr ±30 % + mikro-byty (<30 m²) vyloučeny, robustní statistiky (ořez 5 % extrémů při ≥8 vzorcích), GPS cache bucket 0,5°→0,1° (≈8–11 km; 0,5° = celá Praha, sdílení cizích mediánů), GPS-okruhové výsledky se nepersistují do DB (24 h).
- **Engine — kotva na cenovku inzerátu** (URL flow): cenovka = 3. zdroj s vahou 20 % (de-skálovaná o area/transport — vztahuje se přímo na tento byt); **cap realizované referenční hladiny na 105 % cenovky** (průměr čtvrti nesmí implikovat hodnotu nad cenovkou — zkreslení novostavbami; guard 0,5× a pásmo 30–300k/m² proti překlepům; platí i při shrinkToRegion přes min()). Kotva se vynechá, když je cenovka > 1,4× tržní blend (předražený inzerát netáhne odhad nahoru). Clamp nabídek zpřísněn ±25 %→±20 %.
- **Živě ověřeno**: Travná **8,016M (104 107/m²) = +1,7 % vs. Valuo 7,883M** (rozmezí 7,34–8,70M, vsAsking −10,1 %); K Lučinám (panel) **9,483M (129 901/m²) = +1,1 % vs. Valuo 9,375M** (kalibrace zachována); Cheb regrese OK (45 357/m²). `scripts/valuation-verify.ts` = verifikační skript celého toku.
- **Testy**: +9 (parser VERY_GOOD/pole, engine kotva/cap/guard/shrink-interakce, kaskáda ořez) — celkem **452 testů / 35 souborů**.

### Phase 42 — Odhad: autocomplete adresy s přesnou GPS (Done)
- **`suggestAddresses`** (`geocode.ts`): Nominatim search (`jsonv2`, `addressdetails`, `countrycodes=cz`, limit 6, dedupe) → návrhy s vyčištěnou adresou (ulice + č.p., čtvrť, město), **GPS a wardHints** (address.quarter + suburb — ward v cenové mapě se namatchuje přesně, jako Valuo). Cache 6 h (klíč město|dotaz); <3 znaky → prázdno; selhání → prázdno (ruční zadání zůstává). Nominatim throttling (1/s) až při cache miss.
- **API `GET /api/geocode/suggest`** (auth, force-dynamic): `q` + `cityKey` (město z formuláře se přidá k dotazu → návrhy filtrované na lokalitu).
- **`AddressAutocomplete`** (`valuation/address-autocomplete.tsx`): debounce 350 ms + `reqIdRef` (zastaralé odpovědi ignorovány), klávesy ↑/↓/Enter/Esc, klik mimo → zavření, spinner jen při reálném fetchi, po výběru se dropdown znovu neotevírá (`lastPickedRef` + otevření jen při fokusu), ARIA combobox/listbox.
- **Formulář** (`valuation-input.tsx`): výběr návrhu uloží adresu + lat/lng + wardHints (+cityKey podle s.city); ruční editace adresy **zneplatní GPS i hinty** (setAddressManual). Badge „Přesné GPS určeno" / varování „Adresa bez GPS".
- **Route `/api/valuation`**: explicitní `input.wardHints` z výběru adresy mají **přednost** před reverse geokódem (reverse jen jako záchrana — přepis by vrátil jinou čtvrť, než uživatel zvolil).
- **Živě ověřeno**: Travná → Nominatim vrací k.ú. Jahodnice (není v cenové mapě → region úroveň, ale asking cap absorbuje → ~8,7M, URL flow beze změny 8,0M). Testy: geocode suggest (+5) — celkem **457 testů / 35 souborů**. Code review: dead code, dropdown re-open, ARIA, spinner, throttling pozice — vše opraveno.

### Phase 43 — Odhad: doladění proti Valuo (Travná +3,4 % → −1,1 %) (Done)
- **Diagnóza**: po Phase 41 ukazovala Travná 8,154M (105 895/m²) vs. Valuo 7,883M (102 381) = +3,4 % — uvnitř Valuo rozmezí, ale systematicky vysoko. Valuo je transakční hedonic model (102 381); náš odhad táhly nahoru DVA nabídkové signály: cenovka (115 844, +13 % nad Valuo) a nabídky (120 347, clampnuté na 1,2× realizované).
- **Cenovka se používala dvakrát**: jednou přes cap realizované reference (105 % cenovky), podruhé jako zdroj kotvy s vahou **20 %** — váha 20 % systémově tlačila odhad nad transakční hladinu (inzeráty běžně žádají 5–15 % nad tržní hodnotou; Valuo cenovku vůbec nezná). **Kotva 0,20 → 0,10** (zůstává doplňkový signál pro malé lokality, cap dál dělá hlavní práci).
- **Clamp nabídek horní hranice 1,2× → 1,15× realizované reference** (spodní −20 % zůstává) — horké nabídky paneláků (~127k) nesmí sedět 20 % nad transakční hladinou; K Lučinám (143 699 ≤ 1,15×132 187) a Cheb (49 574 ≤ 1,15×45 357) zůstávají neclampnuté → beze změny.
- **Spread malých čtvrtí**: <100 tx → +2 p.b., <1000 tx → +1 p.b. (Kyje 29 tx: ±8,5 % → ±9,5 %; Valuo ukazuje u takových lokalit ±17 % — jsme skromnější, ne arogantní).
- **Label zdroje realizovaných** ukazuje korekci: `Realizované prodeje — čtvrť Kyje (omezeno cenovkou)` / `(korigováno)` / `(běžný stav)` — UI tak vysvětlí rozdíl mezi hodnotou zdroje (100k) a surovou v tabulce srovnatelných (145 068, +37 %).
- **Živě ověřeno**: Travná **7,795M (101 237/m²) = −1,1 % vs. Valuo** (rozmezí 91 619–110 854, vsAsking −12,6 %); K Lučinám **9,483M (129 901/m²) = +1,1 %** a Cheb 2,653M **beze změny** (regrese OK). Ověřeno i, že inzerát nemá výtah (`lift: false`) — floorMultiplier 0,90 je správný, ne bug.
- **Testy**: +2 (clamp 1,15×, spread <100 tx), váha kotvy 0,2→0,1, label suffix — celkem **459 testů / 35 souborů**.

### Phase 44 — Odhad: adresní transakce z cenové mapy (estate_list) (Done)
- **Evaluace AI scraperů (ScrapeGraphAI vs. Scrapling)**: uživatel chtěl AI scraping (ScrapeGraphAI, d4vinci/Scrapling) na adresní ceny z cenové mapy. Vyhodnocení: self-hosted AI scraping je pomalý (15–60+ s/stránka), bez anti-bot (ScrapeGraphAI) a hlavně **zbytečný** — POC objevil, že veřejné API cenové mapy (`price_map/list` + `estate_list`) vrací **jednotlivé adresní transakce** deterministicky, zdarma, bez LLM.
- **Klíčové zjištění**: `estate_list` (per ward) vrací transakce s **GPS, č.p. (housenumber), velikostní kategorií („Byt, 66–70 m²"), datem a transaction_id** — ale **BEZ ceny** (ČÚZK/Seznam anonymizuje jednotlivé ceny; ani `price_map/parcel/{id}` ji nemá). To vysvětluje, proč ani Valuo nemá adresní ceny — používá hedonic model z agregátů. Živě: Žižkov 718 tx, Kyje 60 tx, Cheb 244 tx.
- **`fetchWardTransactions(cityKey, ctx)`** (`price-map.ts`): drill na čtvrť (přes `getRealizedLocalityForCity` + nové `wardId` v `RealizedLocality`) → `estate_list` → `parseEstateList` (pure, exportovaná): plausibility GPS (ČR 48.4–51.2/12–19), transakce bez `transaction_id` vyhozeny (kolize v dedup). Cache `market_cache` segment `price_map_ward_tx_{months}m` (klíč `ward,<id>` — entity ID jsou globálně unikátní) + memory 6 h; prázdný list se necacheuje; rate-limit + retry dle drill vzoru; selhání → [] (nikdy nevyhazuje).
- **Scrapling odložen**: jediný reálný use-case = century21 (bot protection) — anti-bot stealth má vestavěný; cenovou mapu zvládáme bez něj. Skript `scripts/valuation-ward-tx.ts` = live ověření adresních transakcí.
- **Testy**: +5 (fetchWardTransactions s adresou/bez adresy/neznámé město + parseEstateList pure: transaction_id filtr, GPS filtr) — celkem **464 testů / 35 souborů**. Code review: transaction_id 0 leak opraven, komentáře ke cache klíči/prázdnému listu, parseEstateList export.

### Phase 45 — Odhad: adresní transakce v komparacích (Fáze 2) (Done)
- **Napojení `fetchWardTransactions` do engine**: nová dep `getWardTx` (default `fetchWardTransactions`), fetch paralelně s realized/range (sdílený `realizedCtx` — address/GPS/wardHints). Adresní transakce (estate_list) se zobrazí jako **komparace** — řádky „Žižkov 1291 · prodej · 07/2026 · 0,08 km" místo anonymního agregátu čtvrti.
- **Filtrace**: jen transakce s GPS; okruh 10 km od oceňované nemovitosti (stejný jako nabídkové kompy); velikostní kategorie („Byt, 66–70 m²") přes `parseAreaCategory` (pure, exportovaná) ±30 % plochy; řazení dle vzdálenosti, **cap 5** (UI řeže tabulku na 12 řádků — transakce nemají cenu, víc by ukouslo nabídky s cenou a smysluplný „Odhad" sloupec).
- **`ComparableRow.pricePerSqm` → nullable** (adresní transakce nemají veřejnou cenu — ČÚZK anonymizuje) + nový flag `addressTx`. Null-safe úpravy: `ai.ts` (prompt dostane null + addressTx), UI tabulka srovnatelných (result + PDF report — Kč/m² a „Odhad" ukazují „—", zdroj „adresní transakce").
- **Metodika**: řádek „Adresní transakce: N zobrazených…" — používá **zobrazený** počet (po filtru + capu), ne všech z čtvrti.
- **Živě ověřeno** (`scripts/valuation-verify-tx.ts`): Žižkov 5 transakcí v okruhu 0,08–0,14 km (nejbližší prodeje!), odhad 8,96M; Kyje (Travná) 7,94M (103 111/m²) = **+0,7 % vs. Valuo 7,883M** (kalibrace zachována). Testy: engine 44 (+6: parseAreaCategory 3, adresní transakce 3 — label/pricePerSqm null/soldAt/area střed/distance, GPS filtr, plošný filtr) — celkem **470 testů / 35 souborů**. Code review: cap 8→5 (crowding nabídek), metodika počítá zobrazené — opraveno.

### Phase 46 — Odhad: revize proti Valuo, opravy Fáze A (P0–P1) (Done)
- **Revize celé pipeline Odhadu** (engine → price-map → market-price-service → ai → UI) + živý probe API cenové mapy. Závěr: API **nepodporuje velikostní filtr** (parametry category_cb/estate_* ignoruje — vrací stejný list) a ceny per adresa nejsou veřejné → „100 % jako Valuo" 1:1 nejde (Valuo má hedonic model na privátních transakčních datech), ale po opravách je ±5–10 % od Valuo realistické.
- **BUG 1 (P0) — dvojí započtení lokality**: `mult` rozdělen na `baseMult` (bez category) + finální `mult = baseMult × categoryMultiplier` **jen když realized NENÍ na úrovni čtvrti** (ward průměr už lokalitu obsahuje). Předtím: Vinohrady ×1,2 nafouknuto, Černý Most ×0,7 podceněn. Navíc **de-aplikace category z nabídek** při segmentu „any" + ward (market-price-service medián ×1,2/×0,7 → engine dělí zpět). Metodika ukazuje „lokalita X×" jen když byla použita.
- **BUG 2 (P1) — domy/pozemky**: cenová mapa je jen byty (category_main_cb=1). `isFlat` gate: pro `type !== "flat"` se realized + wardTx nevolají (ušetří rate-limited API), odhad stojí na nabídkách + kotvě, metodika vysvětluje.
- **BUG 3 (P1) — úzké rozmezí při tenkých datech**: <100 tx spread +2 → **+5 p.b.** (Kyje: ±8,5 % → **±13,5 %** při 60 tx, blízko Valuo ±17 %); 100–1000 tx zůstává +1 p.b. (743 tx Žižkova = slušný vzorek); cap 0,18 → 0,22.
- **BUG 4 (P1) — cap na cenovku přeceňoval jeden inzerát**: guard 0,5× → **0,75× průměru čtvrti** (cenovka pod trhem = urgentní prodej/překlep nesmí stáhnout hladinu), cap 1,05× → **1,10× cenovky** (běžné inzeráty žádají 5–15 % nad trhem).
- **Živě ověřeno** (`scripts/valuation-verify-tx.ts` rozšířen): Vinohrady (premium) realized 178 280/m² **bez ×1,2** ✓ (metodika bez „lokalita"), Černý Most (risky) 104 080/m² **bez ×0,7** ✓, Kyje rozmezí ±13,5 %. Testy: engine 44 → 50 (+3 ward category, +1 house, +1 de-kategorizace nabídek, +1 byt default), 3 pinned cap testy aktualizovány (1,05→1,10). Celkem **476 testů / 35 souborů**, typecheck čistý. Code review: zastaralé „105 %" komentáře + de-aplikace category z nabídek — zapracováno.

### Phase 47 — Odhad: Fáze B — indexace na dnešek, AI doprava, clamp multiplikátorů (Done)
- **BUG 5 — indexace realizovaných na dnešek** (Valuo indexuje historické prodeje): nová pure `timeIndexFactor(period, trend)` — průměr okna odpovídá ~středu okna (`2026-02 – 2026-07` → střed 2026-04), trend cenové mapy (ČR) dá poměr nejnovější bod / bod ve středu (lineární interpolace dle skutečných dnů), strop ±10 %. `RealizedLocality` nese `trend` (price-map.ts: `base.trend = data.trend` — reuse dat už načtených drill-downem, žádný nový fetch). Engine: `realizedAdj *= timeFactor`, label „indexováno na dnešek" + poznámka jen když je indexace materiální (>0,5 %); při `asOfDate` se vynechává (o čas se stará `scaleToDate` — zdvojení by zkreslilo). Nabídkový clamp band používá indexovanou hladinu (konzistentní).
- **BUG 6 — AI korekce už nezdvojuje dopravu**: `correctValuation` prompt přepsán — Vlak Index je UŽ ve statistickém odhadu (±6 %), vzdálenosti jsou jen potvrzení, odchylka max ±1 %; ze sousedství pravidla odstraněna „dostupnost metra/MHD" (reziduum dvojího počítání).
- **BUG 7 — clamp kombinovaných multiplikátorů na [0.5, 1.6]**: luxury × novostavba × balkón × zahrada × sklep × premium = ~2,2× → 1,6× (hedonic model Valuo je aditivní v log prostoru); na druhé straně panel × neobyvatelný × družstevní × přízemí × starý rok = 0,46 → 0,5×. Metodika ukáže „omezeno clampem 0,5–1,6" když clamp zasáhne.
- **Živě ověřeno** (rozšířený `scripts/valuation-verify-tx.ts`): Kyje realized 112 439/m² „omezeno cenovkou · indexováno na dnešek", Vinohrady 188 918/m² „běžný stav · indexováno na dnešek" (bez „lokalita"), Černý Most 110 290/m². Testy: engine 50 → 58 (+3 timeIndexFactor, +3 BUG 5 — indexováno/bez trendu/asOfDate skip, +2 BUG 7 clamp 1.6/0.5). Celkem **484 testů / 35 souborů**, typecheck čistý. Code review: práh labelu indexace, reziduum „dostupnost metra/MHD" v promptu, poznámka o clampu v metodice — zapracováno.

### Phase 48 — Odhad: čistě bytové jednotky (Done)
- **Rozhodnutí**: Odhad se používá POUZE na bytové jednotky (žádné domy/pozemky) — cenová mapa i adresní transakce jsou jen byty (category_main_cb=1).
- **Formulář** (`valuation-input.tsx`): odebrán výběr „Typ nemovitosti" (TYPE_OPTIONS flat/house/land) → statický badge „Byt" s popiskem „Odhad je určen pouze pro bytové jednotky".
- **Route** (`api/valuation/route.ts`): při URL parse `inferType` dům/pozemek → **400 s jasnou zprávou** („…tento inzerát vypadá jako rodinný dům/pozemek"); `listingFields.type` je natvrdo `flat`; estimate flow rejectuje `input.type !== "flat"`. **Flat-precendence v `inferType`** (code review nález): `/byt|garsonk|1\+kk|2\+kk/` má přednost před „dům" — „bytový dům"/„panelový dům" v titulu platného inzerátu bytu nesmí rejectnout.
- **Texty**: page /odhad — „Odhad ceny bytu" + popisek zmíní bytové jednotky.
- **Engine**: defenzivní `isFlat` gate zůstává (z UI/routy už nedosažitelný, ale chrání před přímým voláním).
- **Validace**: 484 testů zelených, typecheck čistý. Code review: flat-precendence inferType — zapracováno.

### Phase 49 — Odhad: pořadí cap × indexace (Kyje +7,9 % → +1,4 % vs. Valuo) (Done)
- **Problém**: uživatel znovu porovnal Travná/Kyje (77 m², po rekonstrukci, 3/5 bez výtahu, cenovka 8,92M) — odhad 8,46–8,50M (110–112k/m²) vs. Valuo 7,883M (102 381/m²) = **+7,4–7,9 % nad Valuo**. Před Fází A/B byl stejný byt na +0,7 %.
- **Root cause (BUG 8) — pořadí cap × indexace**: kód dělal `cap → mult → ×timeFactor`. Cap porovnával **surový** čtvrťový průměr (145 068 = střed okna ~duben) s **cenovkou „dnes"** (115 844) — nesrovnatelné; a indexace (×1,025) běžící ZA capem **podruhé nafoukla** už dnešní cenovkou-anchorovanou hodnotu. Plus Fáze A uvolnila cap 1,05→1,10 (kalibrováno bez indexace). Dohromady přesně ten drift +0,7 % → +7,9 %.
- **Fix (index-first)**: `timeFactor` se počítá NEJDŘÍV, indexace surového průměru `indexedWard = raw × timeFactor` (i `indexedRegion`), cap (guard i hladina) porovnává **dnes vs. dnes**, cap zpět na **1,05×cenovky** (110 % bylo bez indexace), `realizedAdj = realizedRef × mult` (dál se nenásobí). shrink ratio/shrinkRef na indexovaných hladinách. Label „indexováno na dnešek" jen `timeIndexed && !realizedCapped` (capnutá hodnota je ukotvená k dnešní cenovce, ne indexovaná). Necapnuté případy beze změny (násobení je komutativní — ověřeno i pro shrink).
- **Živě ověřeno** (`scripts/valuation-debug.ts` — nový diagnostický skript, replika engine krok po kroku): Kyje realized 100 496/m² (bylo 107 904), odhad 7 995 245 Kč (103 834/m²) = **+1,4 % vs. Valuo** (bylo +7,9 %). Vinohrady/Černý Most bez cenovky → beze změny.
- **Testy**: engine 58 → 59 (+1 „indexace NEzdvojuje capnutou hodnotu" — s mocked trendem 1.02925 by cap→index dalo 114 928, správně 111 662 + label bez „indexováno"), 2 pinned cap testy aktualizovány (111662/127313, „omezena na 105 %"). Celkem **485 testů / 35 souborů**, typecheck čistý. Code review: komentáře 1.0249→1.02925, +0,9 %→+1,4 %, hlavička debug skriptu — zapracováno.

### Phase 50 — Odhad: offers cap na novostavbami nafouknutou čtvrť (Žižkov +8,3 % → +0,8 % vs. Valuo) (Done)
- **Problém**: uživatel porovnal K Lučinám 2469/21, Žižkov (72 m², po rekonstrukci, panel, 1. patro, cenovka 8,999M) — odhad 10,18M (139 397/m²) vs. Valuo 9,316M (129 385/m²) = **+7,7–8,3 % nad Valuo**.
- **Root cause (BUG 9)**: Žižkov ward průměr 164 720 (indexovaně 168 823) je nafouknutý developerskými novostavbami (stejně jako Kyje). Cap na cenovku má strážní hranici `asking ≥ 0,75×ward` (chrání před extrémně nízkou cenovkou — podíl/urgent) — ta se ale nespustila: asking 124 986 = **0,74×ward** (o 1,6 % pod hranicí). Nafouknutý ward prošel celý do blendu na 45 % váhy → realizedAdj 152 488.
- **Fix — druhá pojistka (offers cap)**: když `ward && cenovka existuje && cenovka < 0,9×ward (starý fond) && reálné nabídky (db/sreality) && indexedWard > 1,2×nabídkový medián` → `realizedRef = min(realizedRef, 1,2×nabídky)`. Cenovka < 0,9×ward je klíčový diskriminátor „starý fond v novostavbami zamořené čtvrti" vs. prémiová čtvrť (Dejvice/Bubeneč mají cenovku u ward průměru → cap neletí). `range.median` PŘÍMO bez de-aplikace category (nabídky i ward už premium obsahují; de-aplikace patří jen do offers blendu — BUG 1). Label „omezeno nabídkami", poznámka „omezena na 1,2× nabídkový medián"; „indexováno na dnešek" se skrývá i při offeredCapped.
- **Interakce capů je doplňková**: asking cap pokrývá asking ≥ 0,75×ward, offers cap asking < 0,9×ward, překryv [0,75; 0,9] řeší `min()` (konzervativnější vyhrává — shrink test 131 250 < 144 000). Kyje (145 068 < 1,2×126 746 = 152 095) a Vinohrady (bez cenovky → neletí) beze změny.
- **Živě ověřeno** (`scripts/valuation-debug-zizkov.ts` — nový diagnostický skript, fetch přes scrapeUrl + replika engine): Žižkov realizedRef 168 823 → offers cap 152 095 → realizedAdj 137 378 (bylo 152 488), odhad 9 385 920 Kč (130 360/m²) = **+0,8 % vs. Valuo** (bylo +8,3 %).
- **Testy**: engine 59 → 61 (+2: Žižkov offers cap 136 831 + label/estimate 9 097 000; Dejvice prémiová čtvrť nedotčená 205 200). Celkem **487 testů / 35 souborů**, typecheck čistý. Code review: de-aplikace category v capu → range.median přímo; 0,9× cenovka nutná proti capování prémiových čtvrtí; prag 1,2× empiricky nejbližší Valuo (1,15× → −1,5 %, 1,25× → +3,5 %).
- **Známé omezení**: manuální vstup bez cenovky (formulář bez URL) zůstává bez offers capu — bez listing price nelze odlišit starý fond od prémiové čtvrti.

### Phase 51 — Nemovitosti: deduplikace napříč portály + řazení/filtry (Done)
- **Dedup napříč portály** (`alt_portals`): duplicitní inzerát z jiného portálu se už **neuloží jako nový záznam** — jen se přidá do `alt_portals` původního (helpers v `src/lib/scraping/property-match.ts`: `parseAltPortals`, `appendAltPortal`, `hasAltUrl`, `toDbAltPortals`). SQLite text / PG jsonb.
- Orchestrator: deaktivace „ztracených" respektuje alt URL (`allFoundUrls` přes `altPortals`), **oživení z alt URL** (`toRescue`), `saveListing` přeskočí listing, který už je alt URL (`hasAltUrl`) — místo duplicity doplní chybějící údaje; `property-merge.ts` respektuje alt portály. Logo fallback pro karty bez fotek.
- **Řazení 9 režimů** (`properties-explorer.tsx`): newest, priceAsc/Desc, pricePerSqmAsc/Desc, areaAsc/Desc, highestScore, mostUndervalued. **Odnímatelné filtry** — aktivní chipy s křížkem (město, portál, verdikt, stav, skóre, cena, plocha, Podhodnocené, Oblíbené). Fotonázev + meta řádek na kartách.
- **Fix osamocená bílá 0** mezi badge na kartách (React falsy render `{0 && ...}` → explicitní podmínky).
- **Fix chybějící Kč/m²** u bazos.cz a annonce.cz (`pricePerSqm` dopočítáváno v `saveListing`).
- **Fix ořezané bazos titulky** („…, Jižní Předmě" — chybějící konec názvu v DB).

### Phase 52 — Karty nemovitostí: mini-carousel + fotky bez ořezu (Done)
- **Mini-carousel fotek na kartách** (`property-card.tsx`): šipky ←/→ listují fotkami i bez otevření detailu (dřív jen statická první fotka).
- **Hvězdička favorites** na kartě přesunuta vedle SCORE (ne pod ním — nekoliduje s carousel šipkami).
- **Fotky se ořezávaly shora/zdola** (`object-cover`) → oprava zobrazení: boxy **8:5 podle reálných poměrů fotek** (`property-image.tsx` `aspect-[8/5]`), bez pruhů po stranách.
- **Pořadí dispozice/m² na kartách** (dispozice před m²), chipy, **stabilní nadpis** (meta řádek na stejné pozici i při 2řádkovém titulku).

### Phase 53 — Auth: splash animace při přihlášení (Done)
- `LoginSplash` (`src/components/auth/login-splash.tsx`): brandové video `public/realflip-animation.mp4` (1,8 MB, převedeno ffmpeg ze zdrojového `realflip animace 2.mov` 13,6 MB) + poster.
- Video vycentrované v **poloviční velikosti okna** (50vw × 50vh, `object-contain`, loop, muted), dole plovoucí kapsle „Přihlašuji se…" se spinnerem.
- `onPlayedOnce` (timeupdate ≥ duration − 0,25 s) → navigace na dashboard **až po prvním celém průchodu** (dřív se login dokončil dřív, než video dohrálo). Fade in/out přes AnimatePresence.
- Iterace: 1. verze přes celý displej → 2. finální 50 % vycentrovaná. Test `src/components/auth/__tests__/login-splash.test.tsx`.

### Phase 54 — Scraping: kompletní fotky realitymix/remax + čistý popis (Done)
- **`extractRealityMixImages($)`** (`realitymix-parser.ts`): galerie realitymix (main + small `data-src` + hidden-items), http→https, strip suffixů `_detail`/`_nahled`, dedup přes `filterImages` — dřív končilo jen s pár fotkami.
- **Remax**: `crawlListings` obohacuje každý listing fotonázev/fotkami z detailu (přes `enrichListing`).
- **Popis bez HTML tagů**: `cleanHtmlToText()` v `types.ts` — `<br>`/`<p>`/`<li>` → nové řádky, odstranění ostatních tagů + entit. Sreality API vracelo popis jako HTML (`<br />`, `<p>`); aplikováno v url-scraperu, sreality a hyperinzerce adapterech.
- **Unit testy realitymat-parser** s ukázkami reálného HTML (dřív měl testy jen realitymix).

### Phase 55 — Detail galerie: klávesové šipky + velké klikací zóny (Done)
- **Listování fotkami na klávesnici** (←/→) v `image-gallery.tsx` (guard na input/textarea/select).
- **Velké klikací zóny po stranách galerie** — celé boky fotek fungují jako prev/next (fotka mění poměr stran → šipky „ujížděly" pod kurzorem). Blur okrajů zkoušen a odstraněn (`663edf1`).

### Phase 56 — Pipeline v2: karty, sloupce a detaily (Done)
- **Pipeline v2** (`36246bc`): spolehlivý drag & drop — `boardCollision` (pointerWithin na kartách → sloupcích → closestCorners), `useDroppable` sloupce, insert lines, DragOverlay; **terminální fáze** (closed/lost) s potvrzovacím modalem + **konverze na deal**; undo toast; board KPI (počet, progress bar, N overdue). Bez weighted forecastu (`617fe91`).
- **Klíčové údaje karty vždy vidět** (`2fee6bd`): adresa, cena/m², doba na trhu.
- **Přebudování karet** (`43a58c4`): nový `splitAddress()` v `utils.ts` (ulice = první segment, město = zbytek — zvládá i `Brno, 614 00` / `Vašátkova 16 Praha`); **dvouřádková poloha nad cenou** (ulice + město celé, nikdy se neřeže); sloupce 170 → 220 px; jednotný obsah v každé šířce (pryč `@max-[240px]:hidden`); **drag preview = věrná kopie karty** (compact režim zrušen).
- **Čistší hlavičky sloupců** (`b6a25e7`): KPI „X celkem" / „Ø dní" pod nadpisem pryč (zůstává počet + progress bar + N overdue); **poznámka na kartě celá** (line-clamp pryč, `whitespace-pre-wrap`); **listování fotkami v detailu** — LeadDrawer používá `ImageGallery` (šipky, klávesnice, náhledy), API `/api/leads` + `LeadItem` vystavují `propertyImageUrls` (celé pole, dřív jen první fotka).
- **Sloupce se vejdou na obrazovku** (`b112c24`): min-w 220 → pružné `flex-1 basis-0` + `min-w-[160px] lg:min-w-0` (desktop všech 7 bez scrollu, mobil scroll).
- **Kompaktní karty** (`c945ccb`): pryč „X dní na trhu", badge m²/dispozice (jsou v nadpisu), CÍL/ARV/stav/typ budovy/kontakt/relativní čas; fotka h-20→h-14, padding p-3→p-2.5, akce (posunout/ztraceno) do cenového řádku — na hover se plynule rozbalí (w-0→w-auto).

### Phase 57 — Kalkulačka: jemné ROI, reko defaults a opravy (Done)
- **ROI kroky 0.1 %** (`c8de475`): cílové ROI a výnos nastavitelné po 0.1 % napříč flip/aukce/rental/settings; přesný −/+ stepper + číselné pole u posuvníků (`bc17296`), cílová ROI hodnota se zobrazí celá (skryté nativní spinery, širší pole, `1562310`).
- **Cílový výnos až 20 %** (`a78e80e`): v kalkulačce se posunul strop z původních 8 %.
- **Rekonstrukce default 12 500 Kč/m²** (`a9cb5cd`): `perSqm` default ve všech kalkulačkách.
- **URL analýza vrací DB id** (`8a05610`): uložená kalkulačka se po reloadu načte (analýza přes URL vrací id nemovitosti z DB).

### Phase 58 — Brickon portál: fotky, modely spolupráce, karty modelů (Done)
- **Fotky + investice/ROI investora** (`c8f11d5`): fotky nemovitosti a investice+ROI investora u spolupráce v portálu; velká písmena názvů měst (slug → správný český název, `47d2411`).
- **Galerie miniatur** (`69d4e84`): galerie fotek s miniaturami, cena bez přeškrtnutí, přehledný detail výpočtu, sourcing fee jen u fee modelu; později šipky místo pasky miniatur (`f870b59`, jako karty v realflipu).
- **Karty modelů 50/50 + sourcing fee** (`8f0e14c`, `eeb85a0`): karta flipu ukazuje oba modely na plnou šířku, klik rozbalí detail výpočtu daného modelu (accordion); **rezervace vyžaduje výběr modelu**.
- **Nové logo Brickon v e-mailech** (`8f50843`): `public/brickon.svg`.

### Phase 59 — Nemovitosti: konstrukce v detailu, portálu i e-mailu (Done)
- **Chip „konstrukce"** (`a0a5e51`): v detailu nemovitosti mezi rok a stav (pořadí dispozice · patro · rok · konstrukce · stav · velikost); `buildingType` protéká do Brickonu (`investor-portal-view.ts` + `investor-portal.ts` + `notify-offers.ts`), v Brickonu `PropertyMeta` ukazuje „Stav: X · Cihla …" a e-mail nabídek „Stav: velmi dobrý · 2+1 · 89 m² · Cihla · 3. podlaží".
- **Nové labely konstrukce** (`bac6fdb`): `BUILDING_TYPE_LABELS` → **Cihla, Panel, Novostavba, Smíšená** (místo Cihlový/Panelový/Smíšený); projevuje se všude přes `buildingTypeLabel`.
- **Editovatelná konstrukce** (`bac6fdb`): `EditableBuildingType` (`src/components/properties/editable-building-type.tsx`, vzor `EditableCondition`) — tužka → dropdown Cihla/Panel/Novostavba/Smíšená; PATCH `/api/properties/[id]` validuje (`brick|panel|new|mixed`), uloží do `properties.buildingType` a spustí žhavou re-analýzu s čerstvými tržními daty.

### Phase 60 — Brickon: kupní cena, přepočty m² a konzistence nákladů (Done)
- **„Kupní cena" v detailu výpočtu** (`31da885`): první řádek rozpočtu nad „Právní služby" = cílová kupní cena z kalkulačky (`targetPurchasePrice`, fallback `purchasePriceUsed`).
- **Přepočet na m² u cen a ARV** (`31da885`): pod „Inzerovanou cenou" i „Cenou po vyjednání" menší text X Kč/m² (10px, muted); pod ARV v detailu výpočtu taky. Pomocná `perSqmLabel(price, area)` (null → řádek skryt).
- **Náklady celkem = Vaše investice** (`96bdf1a`): horní tabulka brala snapshot z cílové ceny, spodní model přepočítával na vyjednanou cenu → nesoulad. Celý detail je na jedné cenové bázi: „Náklady celkem" = `fundingSourcing`/`fundingFiftyFifty` (přepočtené na cenu, kterou investor platí), sourcing fee je vidět jako řádek rozpočtu u fee modelu.

### Phase 61 — Galerie: fullscreen prohlížení fotek (Done)
- **Fullscreen režim** (`d41fc92`) v `image-gallery.tsx` (detail nemovitosti i lead drawer): tlačítko `ArrowsOutSimple` v pravém dolním rohu fotky → overlay přes celou obrazovku (černé rozmazané pozadí, `object-contain`); šipky ←/→ listují (vč. cyklení), klávesové šipky pokračují, počítadlo „2 / 5"; zavírání křížkem (X), Esc, kliknutím na pozadí; zámek scrollu stránky po dobu otevření. +4 testy.

### Phase 62 — Kalkulačka ↔ Brickon: jednotný výpočet při vyjednané ceně + editovatelná kupní cena (Done)
- **Dvojí cenová báze** (`2cc0342`): RealFlip počítal z cílové ceny (2 596 400), Brickon posouval na vyjednanou cenu z pipeline (2 500 000) → Náklady celkem nesouhlasily. Oprava: **obě strany počítají přesně při vyjednané ceně** — RealFlip kalkulačka ukazuje rozpočet „Výpočet při kupní ceně X" (cílová cena zůstává jako zelená reference), Brickon přepočítává ze snapshotu přesně (`recalcFlipAtPrice` v `investor-portal-view.ts`) **včetně daně z příjmu** (lineární shift ji nechal z původní ceny); daň v `FlipCostRows` se při odlišné ceně zobrazuje přepočtená. Legacy snapshoty bez položkového rozpisu spadnou na původní lineární posun. +3 testy.
- **Editovatelná přesná kupní cena** (`835de03`): zelený box „IDEÁLNÍ KUPNÍ CENA" je editovatelné pole — uživatel zadá přesnou částku (např. 2 500 000) a celý výpočet vč. daně se přepočte přesně z té ceny (místo přibližování ROI sliderem, který řeší cenu z ROI). Při ruční ceně box ukáže dosažené ROI a slider se na něj přepne; pohyb slideru/stepperu se vrátí k plánování z ROI (ruční cena se zruší). `manualFlipPrice` se ukládá do presetu (DB config + localStorage) a do snapshotu jako `purchasePriceUsed`/`flipTargetPurchasePrice` → Brickon ukazuje identická čísla (verbatim, žádný posun).

### Phase 63 — Pipeline: potvrzení vyjednané ceny na kartě + Brickon badge + cleanup (Done)
- **Potvrzení vyjednané ceny funguje i pro česky formátované ceny** (`792dbb8`): prompt „Vyjednáno" na kartě používal `<input type="number">` + `Number(agreeAmount) > 0` — u cen psaných s mezerami jako oddělovači tisíců („2 500 000") prohlížeč vrací prázdný `value`, takže potvrzení zelenou fajfkou se tiše neprovedlo („nic se nestane"). Oprava: `type="text"` + `inputMode="numeric"` + tolerantní parser `parseAmountInput` v `lead-card.tsx` (mezery/NBSP/Kč se odfiltrují — stejný vzor jako kalkulačka/dražby); neplatný vstup ukáže nápovědu „Zadejte platnou cenu v Kč" místo ticha. Stejné parsování (`parsePriceInput`) aplikováno na pole „Vyjednaná cena (s prodejcem)" v lead-draweru. +7 testů (lead-card ✓/Enter/formátované ceny, leads-board celý tok, PATCH route akceptace negotiation).
- **Badge FLIP/NAJEM s plným pozadím** (`5aef53a`): `ModeBadge` v Brickonu (`src/app/investor/(portal)/page.tsx`) měl transparentní „soft" odstíny → plné pozadí + bílý text: FLIP `bg-accent` (zelená), NÁJEM `bg-info` (modrá). Funguje v light i dark režimu (tokeny se v dark zesvětlí).
- **Odstraněna věta z portal-panelu** (detail nemovitosti, `src/components/leads/portal-panel.tsx`): „Investorům se ukazuje jen makrolokalita, stav, m² a ceny — bez adresy a fotek. Rezervace drží 72h a pak se automaticky uvolní." pryč; ukliděn teď nepoužitý prop `reservationHours` (default + předání z `properties/[id]` + import `PORTAL_RESERVATION_MS`).

### Phase 64 — Živé formátování částek při psaní: 5000000 → „5 000 000" (Done)
- **Sdílený `AmountInput`** (`src/components/ui/amount-input.tsx`, commit `3448777`): `type="text"` + `inputMode="numeric"` + `autoComplete="off"`, živě formátuje mezery jako oddělovače tisíců (`formatAmountInput` v `src/lib/utils.ts`: nečíslice odfiltruje, „5000000" → „5 000 000"). `onChange` předává dál **jen číslice** — všechna stávající parsování (`Number`/`parseInt`/`parseAmountInput`) fungují beze změny. Sdílený `Input` dostal rezim `type="amount"` (stejné chování v labelovaných polích).
- **Převedeno ~30 částkových polí napříč aplikací**: kalkulačka (`interactive-analysis.tsx` — sourcing fee, výše úvěru, reko Kč/m² i celkem flip+rental, itemizovaný plán rekonstrukce, Kč pole v rental `NumberField`), pipeline (prompt na kartě v `lead-card.tsx`, nabídnutá/vyjednaná cena + převod na deal v `lead-drawer.tsx`, kupní cena/reko v `stage-transition-modal.tsx`), dražby (`auction-calculator.tsx` — OC/NP/TMV/TD/ARV, TC náklady, reko, sourcing fee), ocenění (`askingPrice`), filtry cen (`properties-explorer.tsx`, `search-form.tsx`), investor budget, nastavení (právní služby, reko Kč/m²), onboarding rozpočet, buy-vs-rent, kalkulačka page (cena, trh/m²), flip kalkulátor. Procenta/m²/plochy/roky/podlaží zůstaly obyčejná číselná pole (bez formátování). Placeholdery částek převedeny na „4 890 000" styl. +5 testů (`formatAmountInput` ×4, živé formátování na kartě).

### Phase 65 — E-mail s novou nabídkou: přesné ceny, bez ROI ročně, přehledný model spolupráce (Done)
- **Přesné ceny místo zaokrouhlených** (`7f2155f`, `src/lib/email/offer-template.ts`): `price()` používal `formatCompactPrice` („7,9 mil. Kč") → `formatPrice` („7 890 000 Kč" přesně jako v DB; NBSP z cs-CZ locale nahrazen v e-mailu obyčejnou mezerou). Platí pro inzerovanou cenu, cenu po vyjednání, zisk i cash-flow.
- **Smazán řádek „ROI (ročně)"** — bral se z `deal.annualizedRoi` (extrapolace z doby držení, u flipu zavádějící). Zůstává jen „ROI (celkem)"; nájem dál ukazuje „Čistý výnos p.a.".
- **„Způsob spolupráce" restrukturalizován**: hodnota = typ investice (**FLIP**/**NAJEM**), pod ním řádek **Model** = „50/50" / „Sourcing fee" / „50/50 nebo Sourcing fee" (velké S, `white-space:nowrap` na buňce hodnoty = jeden řádek). Štítky zisků „Váš zisk při Sourcing fee" s velkým S. Nájem ukazuje typ NAJEM bez Modelu (nájem modely spolupráce nemá); flip bez snapshotu blok spolupráce nezobrazuje. Label modelů z `COOPERATION_STRATEGIES` (`cooperation-models.ts`).
- **Patička**: smazáno „Chcete-li odhlášení, odpovězte na tento e-mail." — zůstává jen „Tento e-mail zasíláme investorům, kteří mají aktivované notifikace v portálu Brickon."

### Phase 66 — E-mail: logo jako rastr (Gmail a Seznam vyřezávají inline SVG) (Done)
- **Příčina**: inline `<svg>` loga v notifikačních e-mailech Gmail a Seznam.cz z HTML **vyřezávají** (tuta.com ho renderovalo — vypadalo to jako „u někoho funguje, u někoho ne").
- **Fix** (`36081a2`): `brickLogoImg(size, baseUrl)` v `src/lib/investor-brick.ts` vrací `<img src="{baseUrl}/brickon.png">` — bílá značka 319×293 s průhledným pozadím (ověřeno vzorkováním pixelů přes System.Drawing), alt „Brickon", `display:block`. `offer-template.ts` používá `<img>` + nový text hlavičky: „Právě jsme pro vás vyjednali novou příležitost! Přihlašte se do portálu pro rezervaci a více informací."
- **Omezení**: Gmail externí obrázky blokuje do kliknutí „Zobrazit obrázky" (zobrazí se alt text) — nevyhnutelné.
- Testy aktualizovány (offer-template + investor-brick), 682/682 zelené.

### Phase 67 — Kalkulačka: „Celková investice" = součet nákladů akvizice (Done)
- **Bug vnímání**: s hypotékou 3,4 M Kč na nemovitost 1 989 440 Kč se úvěr capne na kupní cenu → vklad 0 → „Celková investice" = 962 500 Kč (jen akviziční náklady) — vypadalo to, jako by kalkulačka **odečítala rekonstrukci**. Engine byl matematicky správný (`totalInvested = (cena − úvěr) + právní + posudek + sourcing + reko`), šlo o sémantiku zobrazení.
- **Rozhodnutí uživatele**: „Celková investice" = **součet řádků** (Kupní cena + právní + posudek + sourcing + reko) **všude** (kalkulačka, Brickon portál, PDF); výnosové metriky (CoC, IRR, návratnost) **beze změny** — počítají se z vlastního vkladu.
- **Při hypotéce** sekce „Z toho financováno": řádek „− Hypotéka (úvěr)" (capnutý na kupní cenu) + „Vlastní vklad".
- **Pomocné funkce** (`investor-portal-view.ts`): `rentalTotalAcquisitionCost`, `rentalLoanCapped`, `rentalInvestedValue`; `CalcSnapshotRental` + volitelné `hasMortgage`/`mortgageAmount` (staré snapshoty bez nich fungují).
- **Změněné soubory**: `interactive-analysis.tsx`, `investor-portal-view.ts`, `(portal)/page.tsx`, `property-report.tsx` (PDF), `calc-preset` route. Testy 682 → 685.

### Phase 68 — Kalkulačka: LTV, citlivost na úrokovou sazbu, kumulativní návratnost, benchmark (Done)
- **Návrh „mastermind"** po nastudování konkurence (calkoo, pronajemkalkulacka.cz, KIWI Reality, investicnikalkulacky.cz): přidány 4 doplňky; **vědomě nepřidáno**: flipping/komerční režimy, NPV (IRR stačí), 3 scénáře (pokryje citlivost), odpisy (paušál 30 % §9 je standard), SVJ/utility pole, přepínač cena vs. hodnota.
- **Engine** (`rental-calc.ts`): `ltv` (úvěr ÷ cena, cap 100 %), `cumulativePaybackYear` (první rok, kdy kumulativní CF ≥ celková investice), `mortgageRateSensitivity` + `MORTGAGE_SENSITIVITY_RATES` (3,5–7,5 % po 1 p.b. → splátka/CF měsíčně/CoC).
- **UI** (`interactive-analysis.tsx`): LTV řádek v sekci hypotéky; tabulka „Citlivost na úrokovou sazbu" (jen při hypotéce, zvýrazněný aktuální řádek); benchmark „Dobrý výnos v ČR: hrubý 4–6 %, čistý 2–4 % (v Praze 2,5–4 %)"; InfoBox „Návratnost (kumulativní): rok X".
- **Brickon**: `ltv` v snapshotu (`calc-preset` route + `CalcSnapshotRental` volitelné pole) → **karta i detail** nabídky (LTV vedle „− Hypotéka"/„Vlastní vklad").
- Testy 685 → 692 (54 souborů), typecheck čistý, lint bez nových chyb.

### Phase 69 — Kalkulačka: fond oprav (SVJ) s odhadem dle konstrukce (Done)
- **Problém**: fond oprav (SVJ) chyběl v OPEX — kalkulačka nadhodnocovala výnosy (demo 4 M, 70 m², nájem 24 500: bez FO NOI 235 991/čistý 5,9 %; s FO 2 450/měs NOI 206 591/5,2 %, cílová cena −653 tis.).
- **Engine** (`rental-calc.ts`): `RentalConfig.svjFeeMonthly` (Kč/měs; `null` = odhad, `0` = žádný FO, číslo = vlastní hodnota) + `buildingType`; `svjEstimatePerSqm`/`svjEstimateMonthly` s koeficienty dle konstrukce: **novostavba 20, panel 40, smíšená 45, cihla 50, fallback 35 Kč/m²**; FO v `operatingCostsAnnual`, `fixedCosts` s růstem (`expenseGrowthPct`), `breakEvenRent`; výsledky + `svjMonthly`/`svjIsEstimate`. FO je **provozní náklad — není v „Celkové investici"** (ta = akviziční).
- **UI**: řádek „Fond oprav (SVJ)" ve „Volitelné náklady" — prázdné pole = odhad (zobrazí sazbu dle konstrukce z inzerátu), vlastní číslo přepíše; `savePreset` + `rentalSvjFeeMonthly`/`rentalSvjIsEstimate`.
- **Brickon**: volitelné `svjFeeMonthly`/`svjIsEstimate` v snapshotu → řádek „Fond oprav (SVJ)" v detailu nabídky (nad NOI) + PDF report.
- Testy 692 → 698 (54 souborů), typecheck čistý, lint bez nových chyb; commit `de7761d`.

### Phase 70 — Radar: makro přehled trhu + AI Market Report (Done)
- **Cíl**: stránka `/radar` (taby Trh/Regiony/Města) s makro daty (repo ČNB, hypotéky ČBA, inflace ČSÚ), cenovou mapou katastru, vlastním sledováním inzerátů, heatmapou měst a AI zprávou (Gemini, cache).
- **DB**: `radar_series` (key + period, PK) + `radar_reports` (region_key + range, PK) v PG i SQLite (`src/db/schema/radar.ts`, `src/db/pg/radar.ts`, migrace 0011/0005). DDL migrace nutná přes tagged template: `sql\`${sql.unsafe(ddl)}\`` — samotné `sql.unsafe()` na aktuálním `@neondatabase/serverless` tichounce nic neprovede.
- **Zdroje**: ČNB repo TXT (`vyvoj_repo_historie.txt`, cesta `.galleries`), ČBA (cbamonitor.cz — sazba nových hypoték, objem, inflace; y hodnoty v graph_data jsou **stringy** → `Number()` koerce), ČSÚ opendata CSV: STA09B (zahájené byty, okresy→kraje), STA09A1 (obyvatelstvo), WPRACECRQ (kvartální mzdy: cr=ZJIST 0, kraje=ZJIST 2, 2011+; MZDR vyhozen jako redundantní), PORKR01 (indexy) → inflace z ČSÚ, ne z blade.
- **Engine** (`src/lib/market/`): `radar-store.ts` (fetch+upsert, delta-only), `macro.ts` (ČNB+ČBA), `czso-radar.ts`, `radar-shared.ts` (`REGION_LABELS`, blade parsování), `snapshots.ts` (čisté transformace), `radar-query.ts` (`getRadarData(range)`: KPI, gaps, priceMap řazená sestupně, listingFlow z `firstSeen`/`removedAt`, supplyVsPopulation, cityHeatmap s price-to-rent a 65+), `report.ts` (Gemini + retry + fallback modely `gemini-2.5-flash`, `gemini-3.5-flash-lite` při 503 — `gemini-2.0-flash-lite` je deprecated 404).
- **API**: `/api/market/radar` (GET, range 1q/1y/3y/5y), `/api/market/report` (GET cache / POST force, auth), `/api/market/radar-refresh` (cron x-cron-secret → obnova řad + CPI z DB).
- **Cron**: `vercel.json` 2. cron `/api/market/radar-refresh` (0 6 * * *); `daily-scraper.yml` step odvozuje URL z `SCRAPER_API_URL` (bez nového secretu).
- **UI**: `src/components/radar/` — `macro-charts.tsx` (KPI + Grafy A/B/C recharts), `regions-tab.tsx` (cenová mapa bar + tabulka krajů), `cities-tab.tsx` (listing flow + heatmapa měst), `report-card.tsx` (markdown + „Obnovit"), `radar-page.tsx`; nav `/radar` v `dashboard-layout.tsx`.
- **Náznaky z dat**: priceMap vrací 13 krajů (1 v SSR chybí — netřeba řešit); `stazene` inzeráty řídké (removedAt od 2026-08); cityKey = lowercase slug („praha").
- Testy 698 → 714 (56 souborů), typecheck čistý, lint bez nových chyb.

### Phase 71 — Brickon: logo v popupech, e-maily adminovi, investorem zvolený model (Done)
- **Brickon logo v popupu výběru modelu** místo ikony ruky s mincemi; do popupu potvrzení rezervace se vrátila **fajfka** (`SealCheck`).
- **Admin e-maily** (nová rezervace + zrušení): button „Otevřít investory" → **natvrdo** `realflip.vercel.app/investors` (dřív `{baseUrl}/investors` = portál); částka u „Podíl z obchodu"/„Sourcing fee" na **jednom řádku** (`white-space:nowrap`) a **bez duplicitního „Kč Kč"** (`formatPrice` už měnu obsahuje).
- **Patička e-mailů investorům**: „…nás kontaktovat na cakmak@tuta.com" → „…nás kontaktovat." (bez adresy); „postup — ať už" → „postup, ať už" (e-mail potvrzení + Brickon modal).
- **`portalReservedStrategy`** (investorem zvolený model) se propsuje do karty **„Portál investorů"** na detailu nemovitosti — read-only řádek „Investor zvolil: 50/50 / Sourcing fee" (`PortalPanel` prop `initialReservedStrategy`).

### Phase 72 — Notifikace: mark-read + konzistence badge (Done)
- **`POST /api/investors/unread-reservations`** (`{ investorId }`) označí nečtené `portal_reservation` notifikace jako přečtené (jen ty, jejichž lead je aktuálně rezervovaný daným investorem; bez `investorId` = všechny pro admina).
- **`total` = součet `byInvestor`** — uvolněné/vypršelé rezervace už nedrží menu badge (dřív `total` počítal všechny nečtené bez ohledu na stav → badge visel na čísle).
- **`MarkReservationsRead`** (`src/components/investors/mark-reservations-read.tsx`) na detailu investora → otevření investora = přečtení jeho rezervací.
- Dashboard layout **refetchuje badge na navigaci** (`pathname` dep) → číslo zmizí hned po návratu z detailu.
- Dropdown zvonečku zobrazuje **plný text** notifikace (`line-clamp-2` odstraněn).

### Phase 73 — Investoři: klikací karty (Done)
- **Celá karta investora otevírá detail** (`router.push`, `cursor-pointer`, `role="link"`, Enter/mezerník); odkaz „Detail" smazán; „Upravit"/„Portál zapnout/vypnout" mají `stopPropagation`.

### Phase 74 — Mobilní responzivita dashboardu (Done)
- **Breakpoint `lg` (1024px)** odděluje desktop od mobilu:
  - **Desktop** (`hidden lg:flex`): sidebar 240/68px, width animace převedena na CSS `transition-[width]` (framer `animate={{width}}` pryč), **`h-full` vráceno** (regrese — bez něj zůstala dole mezera).
  - **Mobil** (`lg:hidden`): 
    - **Bottom nav** (Domů, Nemovitosti, Hledání, Pipeline, Více) + `pb-[env(safe-area-inset-bottom)]`; obsah `pb-24 lg:pb-8`.
    - **iOS bottom sheet** („Více"): grabber lišta, `rounded-t-3xl`, slide-up spring, hlavička (RealFlip + **zvoneček** + **theme toggle** + X), scrollovatelný seznam nav, user footer se safe-area. Top bar zcela odstraněn.
  - `NotificationBell` prop **`dropdownAlign`** (right v sheetu) + dropdown `max-w-[calc(100vw-2rem)]`.
- **Globální mobilní polish** (`globals.css`): **iOS zoom fix** (`input/select/textarea { font-size: 16px }` ≤640px — jinak Safari autozoom při fokusu), `main h1` na mobilu 24→20px (`!important`, scoping jen dashboard), `-webkit-tap-highlight-color: transparent`, `overscroll-behavior-y: contain`, `text-size-adjust: 100%`.
- **Viewport** (`layout.tsx`): `themeColor`, `interactiveWidget: "resizes-visual"`, **`maximumScale: 1, userScalable: false`** — **uzamčení zoomu** (fixní jako nativní app, ověřeno v buildu: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`).

### Phase 75 — Mobilní pass stránek (Done)
- **Odstraněn duplicitní root padding `p-6`** u searches (list/detail/new/edit) — layout už padding dává (`p-3 sm:p-4 lg:p-8`); responzivní hlavičky (`flex-col sm:flex-row` + `flex-wrap`), tap cíle na kartách hledání.
- **Tap cíle ≥40px**: `PctStepper` (h-6→h-10), carousel šipky + favorite na kartách, paginace, toolbar selecty (`h-9`→`h-10`), close buttony modálů, holé ikon-buttony v Alerty/Úkoly (`h-9 w-9`).
- **Kalkulačka/aukce**: „Volitelné náklady" 1 sloupec na mobilu, hypotéka/comps `sm:grid-cols-3`, citlivostní tabulka `overflow-x-auto`, **slidery (ROI/výnos) stack na mobilu** (label nad sliderem, stepper pod, na `sm:` vedle sebe).
- Portfolio detail (fáze stack, metriky `grid-cols-3` zmenšené), vykupy (analyzer form `flex-col sm:flex-row`), market price-index hodnoty viditelné na mobilu, radar XAxis `preserveStartEnd` + report header `flex-wrap`, dashboard hover šipky viditelné, odhad steps `flex-wrap`, `PriceTag` `lg` → `text-2xl sm:text-3xl`.

### Phase 76 — Detail nemovitosti: mobilní redesign (Done)
- **Full-bleed galerie** na mobilu: hero karta `-mx-3 sm:-mx-4 max-lg:rounded-none max-lg:border-x-0 lg:rounded-2xl` (galerie přes celý displej bez rámečku, jako Airbnb/Realto).
- **Spec chips** jako `grid grid-cols-3` (6 boxů, 2 řádky).
- **Sbalitelná kalkulačka**: `InteractiveAnalysis` prop **`collapsibleOnMobile`** (jen detail přes `PropertyDetailAnalysis`) — na mobilu (`window.innerWidth < 1024`, hydratace-safe přes `useEffect`) je kalkulačka **sbalená** s hlavičkou „Kalkulačka · Sbalit/Rozbalit" + chevron; klíčová čísla zůstávají v metrikách nad ní. Desktop/analyzátor vždy rozbalené.
- **Nastavení**: taby na mobilu → **iOS segmented control** (bílá pilulka v zaobleném kontejneru, `lg:` zachová desktop accent-border styl); obsah `space-y-3`, řádky `p-3 sm:p-4`, avatár profilu menší.

### Phase 77 — Uzamčení zoomu + Pipeline mobilní seznam (Done)
- **Zoom lock** viz Phase 74 (viewport `maximum-scale=1, user-scalable=no`).
- **Pipeline → nativní mobilní seznam**: na mobilu (<1024px) nahrazuje kanban **vertikální seznam leadů seskupený podle fází** (`MobileLeadList`/`MobileLeadRow` v `leads-board.tsx`): miniatura, název, adresa, chip fáze (tečka), cena, skóre, Deal/Rezervováno/Propadl krok, hvězdička priority; klepnutí → LeadDrawer. Kanban board `hidden lg:block`. Detekce `window.innerWidth < 1024` + `resize` listener (jsdom testy pass — default innerWidth 1024px).
- Testy zůstávají **714/714**, typecheck čistý, build OK.

### Phase 78 — Detail nemovitosti: nativní mobilní UX + JS zoom lock (Done)
- **JS zoom lock** (`src/components/shared/zoom-lock.tsx`, mount v `Providers`): iOS Safari ignoruje viewport `maximum-scale=1` (accessibility) → `touchmove` s `{passive:false}` blokuje jen **2+ prsty** (jednoprstý scroll/swipe zůstává), iOS `gesturestart/change/end` blokovány. **Výjimka**: `.leaflet-container` (mapa si nechá vlastní pinch — ovládací prvek mapy, má i +/-). `globals.css`: `touch-action: pan-x pan-y` na `html, body` (scroll ano, pinch/double-tap ne).
- **Sticky top bar** na detailu (mobil `lg:hidden`): `sticky top-0 -mx-3 sm:-mx-4 -mt-3 sm:-mt-4 glass` — šipka zpět → `/properties` + zkrácený název; textový „Zpět na přehled" jen desktop.
- **Galerie swipe** (`image-gallery.tsx`): pointer events (jen `pointerType === "touch"`), práh 60 px, vertikální záměr → nechá scroll; drag offset + spring zpět (`300ms cubic-bezier`); klik po swipu neotevře fullscreen (`dragState.moved`). Nový prop **`immersiveOnMobile`** → na mobilu `aspect-auto h-[52dvh]` (desktop 8:5, lead drawer 8:5), `touch-pan-y`. **Tečky stránek na mobilu** (`lg:hidden`, aktivní `w-5 bg-white`), počítadlo „2 / 5" jen desktop; pruh miniatur skrytý na mobilu při immersive.
- **Sticky spodní akční bar** (`src/components/properties/property-action-bar.tsx`): `fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)]` (nad bottom nav) — velké **Zavolat** (`tel:`, bez telefonu = neaktivní span), **Sdílet** (Web Share API `navigator.share`, `AbortError` = tichý, fallback `navigator.clipboard` + toast), **hvězdička** (FavoriteButton). Stránka má `pb-16 lg:pb-0` navíc.
- **Grouped-list na mobilu** (detail `/properties/[id]`): helper `flatOnMobile` = `max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:border-t max-lg:border-border/50 max-lg:shadow-none` — popis/historie/mapa/pipeline/portál/lokalita/dražba/kontakt/odhad/PDF/kalkulačka se slijí do jednoho souvislého seznamu s dělicími linkami (pryč „card sandwich"); `grid max-lg:gap-0`, sloupce `max-lg:space-y-0`. `PortalPanel`/`LocalityProfile`/`InteractiveAnalysis` (+`PropertyDetailAnalysis`) dostaly optional `className`. Skóre gauge na mobilu přesunut na fotku dolů (`max-lg:bottom-3 max-lg:top-auto`), plovoucí akce přes fotku zrušeny.
- Testy +9 (zoom-lock pinch/scroll/mapa/gesture, gallery swipe práh + immersive výška, action bar render + clipboard fallback) → **723/723 (58 souborů)**, typecheck čistý, build OK, lint bez nových chyb (20 pre-existing v netknutém kódu zůstalo).

### Phase 79 — Neon egress: vyčerpaný limit 402 + tuning spotřeby (Done)
- **Problém**: Neon Free má 5 GB egress/měsíc — vyčerpáno → **HTTP 402** na všechny dotazy → login vždy „Neplatný email nebo heslo" (heslo i uživatel v DB byly v pořádku). App čte **Neon** (`DATABASE_URL` v `.env.local`), ne lokální `data.db` (ta je jen seed, 0,3 MB, 1 uživatel).
- **Diagnostika**: `npx tsx -` (stdin) + `scripts/_env` (SELECT uživatele + bcrypt compare); Neon chyba sedí v `e.cause.message` (402 *"exceeded the data transfer quota"*).
- **Řešení**: upgrade na **Launch** (usage-based, **500 GB egress v ceně**). Usage 8/2026: compute **74,97 CU-h**, storage 0,05 GB, egress 5,5 GB → odhad ~**$8/měs** (74,97 × $0,106; po tuningu ~$4–6). Vybrán preset **„Intermittent load / 1 GB"** (strop autoscalingu + storage, ceny per-unit stejné).
- **Tuning egressu** (commit `09be2e0`, rozsah A+B+D, valuation beze změny):
  - **A1 frekvence**: `vercel.json` jen `/api/scraping/trigger` 6:00; GH `daily-scraper.yml` → **„Radar Refresh"** (cron `0 6 * * *`, jen radar-refresh, `workflow_dispatch` zůstává) → **scraping 1×/den (Vercel) + radar 1×/den (GH)**.
  - **A2 radar delta**: `radar-store.ts` `upsertRadarSeries` zapisuje jen posledních **60 měsíců** (= max. range 5y v UI; starší zůstávají) — čisté fce `radarWriteCutoff`/`filterToWriteWindow` (+4 testy). ~75 % méně zápisů, s 1×/den ~94 %.
  - **B3 price index**: `getPriceIndex()` — memory 15 min + `market_cache` (segment `price_index_cr`, TTL 24 h, payload JSON); route volá wrapper, `computePriceIndex` zůstává exportovaný.
  - **B4 radar čtení**: `getRadarData` **cache 15 min** (per range); `loadListingSnapshot()` sdílí **jeden scan** properties+analysis mezi `getListingFlow` a `getCityHeatmap` (dřív 2×); `readSeriesMany` (IN regionKeys) pro `getSupplyVsPopulation` — 30 → 2 dotazy.
  - **B5 lokality**: nový `src/app/api/locality/route.ts` (batch `GET ?cities=a,b,c` → `results`, reuse `getLocalityForProperty`, Promise.all) + `LocalityMarkets.load()` volá 1× místo N sekvenčních requestů. (Vliv hlavně na HTTP/latenci; DB dotazy malé.)
  - **B6 market**: nový `src/lib/market/market-summary.ts` (`getMarketSummary()` — KPIs, cityRows, trend, priceDrops, topByScore, **cache 15 min**) + `market/page.tsx`; `cityKeys` (surové slugs) pro batch lokality.
  - **D11**: `unread-reservations` GET → `WHERE id IN (leadIds)` místo full scanu všech rezervovaných leads (při prázdných leadIds žádný dotaz).
  - **D12 polling**: `dashboard-layout.tsx`, `notification-bell.tsx`, `investors/page.tsx` → interval **30 s → 60 s** + pauza při `document.hidden` (`visibilitychange`).
- Testy 714 → **727 / 59 souborů** (+4 radar delta), typecheck čistý, build OK, žádné nové lint chyby. Odhad dopadu: scraping+radar ~75–94 % méně zápisů, market/radar stránky bez full scanů, polling neodsává na pozadí.
- Po upgradu je login ověřen (DB OK, `password match: true`).

### Phase 80 — Deska modul: edesky.cz portál (Done)
- **Cíl**: sledovat české úřední desky (edesky.cz) pro realitní příležitosti (dražby, exekuce, prodeje pozemků, stavební řízení).
- **Scraper** (`src/lib/deska/edesky-client.ts`): `edesky.cz/api/v1/` — XML přes `fast-xml-parser` (`npm install fast-xml-parser`). **VOP riziko**: edesky.cz zakazuje redistribuci surových dat (100k CZK pokuta) → **klientská klasifikace**, raději agregace než full-text copy.
- **Klasifikace** (`src/lib/deska/classify.ts`): `normalizeText()` stripuje diakritiku před porovnáním; rozšířený `STAVEBNI_RIZENI` keyword set → 173 dokumentů klasifikuje správně (901 prodej pozemku, 17 dražba, 4 exekuce, 173 stavební řízení).
- **DB**: `deska_documents` + `deska_watches` (SQLite `src/db/schema/deska.ts` + PG `src/db/pg/deska.ts`), migrace `0025_deska.sql` **aplikovaná na Neon**.
- **API** (`src/app/api/deska/`): 7 route — search, documents, documents/[id], watches, poll, create-property, by-locality.
- **UI** (`src/app/(dashboard)/deska/`): page + [id]; komponenty `category-badge`, `deska-card`, `deska-search`, `watch-manager`.
- **Cron**: `/api/deska/poll` (0 8 * * *) v `vercel.json`. Skripty: `scripts/migrate-deska.ts`, `scripts/test-deska-api.ts`, `scripts/verify-deska.ts`.
- Nav položka „Deska" (ikona `ClipboardText`).

### Phase 81 — Insolvence modul: ISIR rejstřík (Done)
- **Cíl**: monitorovat český insolvenční rejstřík (ISIR) pro bankroty, kde správce zpeněžuje byty dlužníků.
- **SOAP client** (`src/lib/isir/isir-client.ts`): endpoint `https://isir.justice.cz:8443/isir_public_ws/IsirWsPublicService` (NE `/isir_ws/`), **bez autentizace**, namespace `http://isirpublicws.cca.cz/types/`. Jen 2 operace: `getIsirWsPublicPosledniIdDataRequest` (prázdné tělo → `cisloPosledniId`) + `getIsirWsPublicIdDataRequest` (`idPodnetu` → víc `data` elementů). **Quirks**: ŽÁDNÝ SOAPAction header (způsobuje chybu), body element = request type name; response má `ns2:` prefix (stripnout před fast-xml-parser), Czech znaky občas mangled (server). Sekce A (podnět), B (rozhodnutí/bankrot — relevantní), C (pohledávky), D (zpeněžení — relevantní), E (platby). `poznamka` = embedded XML s `<druhStavRizeni>` (KONKURS/ODDLUZENI) + `<idOsobyPuvodce>` (soud). 1 Podnet ID → mnoho eventů (např. 53 pro ID 80115400); ID jsou sekvenční.
- **PDF parsing** (`src/lib/isir/apartment-parser.ts`): `pdf-parse` **v2 API** (`new PDFParse({ data })` + `.getText()`, ne staré `pdfParse(buffer)` default), regex na dispozici/plochu/adresu/LV/katastr/cenu. **Ověřeno**: 4/4 sample texty.
- **Scoring** (`src/lib/isir/scorer.ts`): `scoreInsolvencyLead()` 0–100 (sekce B/D, typ řízení, lokalita, časový útlum).
- **DB**: `insolvency_events` (19+ sloupců) + `isir_polls` (8), migrace `0026_isir.sql` **aplikovaná na Neon** (2 tabulky + 8 indexů).
- **Cron** (`src/app/api/isir/cron/route.ts`): Bearer `CRON_SECRET`, fetch feed → filtrace sekcí B/D + apartment candidates → PDF → skóre → uložit; dedup dle `spisovaZnacka`; skóre ≥70 → in-app notifikace. `MAX_IDS_PER_RUN = 50`, 2,5 s delay/ID, `maxDuration = 300`.
- **API**: `/api/isir/documents` (GET, filtry status/score/section/pagination), `/api/isir/documents/[id]` (GET + PATCH status/notesUser/score/contactedAt), `/api/isir/polls` (GET posledních 20).
- **UI**: `/isir` (filtry skóre/sekce/stav, pagination) + `/isir/[id]` (apartment info, řízení, poznámky/stav, odkaz na isir.justice.cz). Komponenty `insolvency-card`, `score-badge`, `section-badge`.
- **Nav** „Insolvence" (ikona `Scales`).
- **Build fixes nutné k deployi**: `Scale` → `Scales` (phosphor-icons nemá `Scale`), `safeJsonParse` s kompletním fallbackem (ne `{}`), `pdf-parse` v2 API. **Vercel Hobby limit**: cron MAX 1×/den → `0 */6 * * *` blokoval deploy 402 → změněno na `0 6 * * *`.
- Ověřeno: `getLastPodnetId()` → 80115480, `getEventData(80115400)` → 53 eventů s korektním dekódováním ČZ.

### Phase 82 — Realingo premium integrace: Valuo rating + nabídky s předstihem (Done)
- **Zdroj**: Realingo.cz GraphQL (creds `REALINGO_EMAIL`/`REALINGO_PASSWORD` na Vercelu) → `src/lib/realingo/` (`graphql-client.ts`, `sync.ts`, `realscan.ts`, `offers.ts`, `types.ts`). Bez creds je sync disabled (`{ scanned:0, saved:0, errors:["Realingo disabled"] }`).
- **DB**: `properties.priceRating` (Velmi dobrá/Dobrá/Férová/Vyšší/Vysoká cena), `priceRatingJson` (PG jsonb / SQLite text), `isEarlyOffer` (0/1 = „Předstih").
- **Settings**: Realingo config panel (creds, enable/disable, `syncState`, tlačítko „Spustit sync" → `POST /api/realingo/trigger`).
- **UI badge/tag**: `RATING_VARIANT` mapa (success/default/warning/danger) + Badge „Předstih" (info) napříč plochami — grid i list `properties-explorer`, detail `properties/[id]`, `searches/[id]`, dashboard (Nejpodhodnocenější + Nejnovější), `call-mode`, `lead-card`/`lead-drawer`. API vrací pole v `dashboard/stats`, `leads` (`propertyPriceRating`/`propertyIsEarlyOffer`), `call-mode`; full row v `searches/[id]`. Vynecháno: investor portál + `interactive-analysis` (data tam nejsou).
- Testy 727 → 738 / 60 souborů, typecheck čistý, build OK.

### Phase 83 — Fix „Sync error: fetch failed": manuální triggery in-process (Done)
- **Příčina**: `/api/{ares,isir,realingo}/trigger` dělaly self-fetch na `${NEXT_PUBLIC_APP_URL}/api/.../cron` s `Authorization: Bearer CRON_SECRET`. Na Vercelu nebyla APP_URL validní (Fallback/example `http://localhost:3000`) → fetch ze serverless funkce na localhost → undici „fetch failed". Vercel cron (scheduler) tím netrpěl — volá cron route přímo.
- **Fix**: trigger routes volají sdílenou in-process logiku místo self-fetchu: `syncRealingo()` (Realingo), `runAresPoll()` (`src/lib/ares/run-poll.ts`), `runIsirPoll()` (`src/lib/isir/run-poll.ts`). Logika ares/isir byla natvrdo v cron route — vytažena do lib, cron i trigger ji sdílejí. Auth triggerů = jen session; CRON_SECRET se nikam neposílá. `maxDuration` shodné s crony: realingo 60, ares 60, isir 300. Chyba: `{ error: "Sync error: <msg>" }` (Settings čte `data.error`/`data.saved`).
- `NEXT_PUBLIC_APP_URL` zůstává pro absolutní e-mailové odkazy (`notify-offers.ts`, `investor-portal/reserve`) — na Vercelu nastavit na produkční doménu.
- Testy 738/738, typecheck čistý, build OK.

### Phase 84 — Kompletní code audit + vlna oprav (Done)
- **Revize všech vrstev** (4 paralelní audity: API/auth/DB, scraping/market, valuation/kalkulace, frontend). Testy 738 zelené, ale kritické chyby NEODHALY → doplněno +29 regrese testů.
- **P0 #1 — mrtvý auth gate**: `src/proxy.ts` (Next 16 middleware) `publicRoutes.some(r => pathname.startsWith(r))` → `"/"` matchne vše, 401/redirect nikdy neběžel. Fix: čistě testovatelná pravidla `src/lib/proxy-rules.ts` (`isPublicPath` přesné matchy + prefix segmenty `/login /register /api/auth /report`; `isMachinePath` — cron/API bez cookie, které si hlídají secret samy: scraping/trigger, deska/poll, isir|ares|realingo cron, radar-refresh, vykupy/leads). Regresní test `proxy-rules.test.ts`. Navíc `(dashboard)/layout.tsx` `auth()`+`redirect` (defense-in-depth — server pages dříve renderovaly data anonymům).
- **P0 #2 — scraping cron 405**: Vercel cron posílá GET, route jen POST+x-cron-secret → denní scraping nikdy neběžel. Fix: `GET`+`POST` přes `runScraping`, auth `Bearer CRON_SECRET` NEBO `x-cron-secret` NEBO session (fail-closed bez env), `maxDuration 300`. Market backfill `refreshAllMarketData()` přes `after()` (fire-and-forget se na Vercelu usekl po response).
- **P1 bezpečnost**: `parse-auction` session auth + `isPortaldrazebUrl` hostname guard (substring regex propustil myportaldrazeb.cz); `market/radar` GET + `market/report` GET auth + try/catch; secret guardy ares/isir/realingo/deska fail-closed přes `src/lib/cron-auth.ts` (`hasCronBearer`/`digestEquals` sha256 timingSafe — „Bearer undefined" už neprojde); `vykupy/leads` POST fail-closed; `leads/[id]/portal` userId scoping (IDOR); `investor-portal/reserve` atomický podmíněný UPDATE `.returning()` + expired-reservation steal + adresa maskována v JSON response/modalu (UI politika). **Finální politika po dohodě**: UI + offer e-maily jen `město · čtvrť`; potvrzovací e-mail po rezervaci (i zrušovací) ZÁMĚRNĚ nese plnou adresu + `contact` blok (jméno/tel/e-mail prodejce) — admin e-maily neměněny.
- **P1 logika**: onboarding array→`JSON.stringify` (SQLite i PG zápis byl rozbitý, klient silent-fail) + klient kontroluje `res.ok`; **aukce `buildFlipConfig`: sourcing fee i při `sourcingEnabled:false`** → phantom −100k v `costs` (ROI/strop/break-even zkreslené, default flow!), fix `enabled ? fee : 0` + 2 testy; `analyze-url/comps` spárované filtrování price+area (dřív index mismatch → špatný medianPricePerSqm).
- **P2 data**: `safeJsonParse` nyní přijímá `unknown` — PG jsonb (už-parse object) i SQLite string (fixuje deska OCR a isir PDF re-parsing v prod); localita: `poi.ts` read/write segment sjednocen na `"poi"` (městská cache nikdy netrefila) + walkability v insert values + retry cap 2 na 429/403, `median([])` null (ne 0 → inverted best-score), `transport.ts` fallback write pod městský segment + `source/quarterLabel` v countsJson, `scoreTransportDistance` all-null → **null** (ne 0; `transportMultiplier(null)=1` — konec tiše −6 %), engine transport gate `sampleSize>=3`; market cache: klíč + `__a{area bucket}` + `__x{adj}` pro per-property výsledky (DB persist jen pro city-level), `fetchComparableSamples` ORDER BY lastSeen/soldAt DESC před limitem; orchestrator: `hasAltUrl` merge target (fix duplicate při re-crawlu), `rescueDeactivatedByAltUrl` cross-portal (bez portalName filtru, 30d window), `pricePerSqm` NULL overwrite fix; hyperinzerce condition `project` → sdílený `inferConditionFromText`; `filters.detectPropertyType` **flat precedence** před garage/land/house (saved-search zahozy „byt v rodinném domě"); annonce desetinná čárka; mmreality SSR↔DOM párování přes `cardId`/slug match (ne index); radar `setMonth` overflow → `periodMonthsAgo` (year*12+month aritmetika, testy na 29.–31.); `loadListingSnapshot` in-flight dedup + 60s memo (1 scan místo 2); isir/ares cursor jen na nejdelší success prefix (žádné permanentní ztráty), `apartmentsFound` počítá byty ne případy, publishedAt NaN guard, ISIR „N" substring → explicitní nenalezen/not found; create-from-url/auction: `filterImages` gatekeeper, initial `priceHistory` row, create-from-url `live=false`+maxDuration 60.
- **P2 kalkulace/portal**: preset roundtrip (`rentalRenovation*` do POST configu; `sourcingEnabled` boolean se už nepřepracovává); PDF report normalizuje oba tvary `report-config-<id>` + `manualFlipPrice` jako target báze; `recalcFlipAtPrice` pct fee přepočet (`sourcingFeeIsPct`/`sourcingFeeRate` ve snapshotu) + 50/50 basis na `noFee.totalCost`; rental `termYears` clamp + `equityMultiple` guard; flip `holdingMonths||default` (0 → ±Infinity dřív).
- **Frontend**: login `signIn` try/catch (network error uvěznil splash) + timer se nepřepisujech, `LoginSplash.onError` přes guarded `report()`; `auction-calculator` localStorage hydration fix (default + effect, autosave gated); `router.push` v render → effect (searches/[id]/edit); loading `p-6` duplicity pryč (vykupy/[id], searches/new, searches/[id]/edit); `MobileLeadRow` role/tabIndex/keydown; notification click `router.push` (ne full reload) + `markRead` error handling.
- **Úklid**: mrtvý kód pryč (`engine askingPrice`, `handleRoiChange`, `needsLight`, `fetchPoi`, `MAX_PAGES`, mrtvý `like(address ?? "")`); sdílený `parseAmountInput` + `csDays` v utils (lead-card/property-card/properties-explorer plurály den/dny/dní); lead-drawer parser odolný na NNBSP+desetinnou; `save-deal` default status `"purchased"` (ne mrtvé „new"); email normalizace lowercase register+login+profile (+ legacy fallback při authorize), `profile` PATCH vyžaduje `currentPassword` při změně hesla, bcrypt cost sjednocen na 12; `pipeline-board` reindex position při cross-stage insertu + deterministický `byPos` tie-break; `parseEstateList` dedup transaction_id; price-map prázdný drill list se necachuje do memory; `create-from-auction` filterImages. Doc drift opraven v CLAUDE.md (11 adaptérů, clamp [0,80×;1,15×], price-map TTL 24 h, cron GET+Bearer, proxy/auth sekce).
- **Známé debt (neresolved záměrně)**: investor heslo odvozené od příjmení + in-memory rate limit (MVP Brickon); dual-schema `as`-cast sjednocení; Vercel cron vyžaduje GET (hotovo) — GH `drazby-hunter` GET na /api/vykupy/leads (machine path); god-component refaktory (interactive-analysis, portal page, leads-board); react-query provider bez useQuery (TODO v providers).
- Verifikace: `tsc --noEmit` čistý, **764/764 testů (61 souborů)**, `next build` OK, eslint bez nových chyb.

### Phase 85 — Realingo fotky: fallback z veřejné stránky nabídky (Done)
- **Diagnóza** (skripty `repro-realingo-save.ts`/`realingo-verify.ts`): titulky i Valuo rating se do prod DB dostávají (81/81), ale `image_urls` bylo `[]` u všech řádků — `searchOffer` vrací `photos: null` (locked/předstih i ostatní). UTF8 teze (em-dash/smart quotes) vyvrácena — insert padal jen na testovacím NOT NULL/FK, ne na encodování. Introspece API blocked (Apollo), `Query.offer` je wrapper `OfferResult` (bez fotek) → GraphQL detail nedostupný.
- **Řešení**: fotky jsou veřejně v SSR HTML stránky nabídky (`/static/images/offer/…jpg`, ~27 URL, bez authu). Nové `src/lib/realingo/page-photos.ts` — `parseRealingoPagePhotos` (dedup webp+jpg na jpg, zachování gallery order, cap 10) + `fetchRealingoPagePhotos`. `syncRealingo()` po mapingu listings dotahuje fotky pro řádky s `imageUrls: []` — budget 8 dotazů / elapsed < 30 s (kvůli 60s limitu na ingest), nestížené dotáhne další cron (saveListing update path sloučí fotky `newImgs>=oldImgs`).
- **Účet-row fix**: `realingo_account` v prod neexistovala (setup nedokončen z UI) → status/`lastError` se ztrácely v no-op UPDATE. `syncRealingo()` nyní upsertuje řádek (defaultami + sync proběhl `enabled:1`), chyby syncu jsou vidět v Settings.
- **Backfill**: `scripts/backfill-realingo-photos.ts` — 78/81 prod řádků doplněno po 10 fotkách; 3 bez fotek = zemřelé nabídky (SSR fallback stránka, generic title). `realingo-verify.ts` fixnut na PG `jsonb_array_length("image_urls"::jsonb)` (SQLite-only funkce).
- Testy +6 (795/795), `tsc`+eslint čisté. K otestování end-to-end v prod: nastavit reálné `REALINGO_EMAIL`/`REALINGO_PASSWORD` na Vercelu (přítomné, ale prázdné hodnoty → pull vrací `""`).

### Phase 86 — Rating normalizace dle tier mapy webu + RealScan diagnostika (Done)
- **Root cause driftu ratingu**: Realingo web **nepoužívá** `loadPriceStats.label` — mapuje tier sám (frontend chunk `_app`, mapa `u`: 1=„Vynikající cena",2=„Dobrá",3=„Férová",4=„Vyšší",5=„Vysoká"). API vrací starší slovník (tier 1=„Velmi dobrá cena") → badge se lišil systematicky. **Fix**: `rating.ts` `TIER_LABEL` + `normalizeRatingLabel(label, tier)` (rozhoduje tier, label jen fallback); `toRawListing` ukládá web slovník; `RATING_META` má „Vynikající cena" (tier 1 success) i legacy „Velmi dobrá cena" alias. Jednorázový přepočet prod dat: `scripts/normalize-realingo-ratings.ts` (81 zkontrolováno, 45 přepsáno). Druhý faktor rozdílu = stáří (web počítá live; sync denně — viz cron níže).
- **RealScan „nepodařilo vytvořit"**: GraphQL mutace vrací prázdný výsledek bez chyby (ověřeno probingem: tvar `createValuationScanFromOffer → ValuationScan` sedí, `Query.valuationScans` existuje bez offer filtru) → business odmítnutí účtu (kredity/plán, dedup, nebo nevalidní offer). `createScanFromOffer/getScan/getScanComparables` nyní hází `RealingoScanError` s `detail` (celý GraphQL response), route loguje `detail` do Vercel logs a vrací rozlišené hlášky: auth→„creds na Vercelu", „Offer not found"→„nabídka zanikla", jinak message+hint o kreditech; panel showuje error+hint. Příští odmítnutí tudíž ponese skutečnou příčinu.
- **Pozor data**: Vercel cron `/api/realingo/cron` (0 11 * * * UTC) za poslední 2 dny **neměl jediný request v logech** → prod data byla freeze od 31.8. do dnešního ručního triggeru (81 řádků touched). Současně burst 40×500 na `/api/ares/cron` a `crime.ts` 404 na policie.cz měsíční XLSX (další issue).
- Testy +5 (800/800, 65 souborů), `tsc`+eslint+build čisté.

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
- `src/lib/scraping/adapters/` — 11 adapters (sreality, idnes-reality, realitymat, realitymix, bezrealitky, bazos, mmreality, annonce, reality-cz, hyperinzerce, remax)

### Analysis / Calculator
- `src/lib/analysis/flip-costs.ts`
- `src/lib/analysis/rental-calc.ts` — výnosový engine (LTV, citlivost na sazbu, kumulativní návratnost, fond oprav SVJ dle konstrukce, IRR, verdikt) + `src/lib/analysis/__tests__/rental-calc.test.ts`
- `src/lib/analysis/types.ts`
- `src/lib/investor-portal-view.ts` — snapshot ↔ Brickon view (Celková investice, LTV, financování, spolupráce)
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

### Deska (edesky.cz portál) — Phase 80
- `src/lib/deska/edesky-client.ts` — edesky.cz API klient (XML → fast-xml-parser)
- `src/lib/deska/classify.ts` — klientská klasifikace kategorií (normalizeText bez diakritiky)
- `src/db/schema/deska.ts` + `src/db/pg/deska.ts` — `deska_documents` + `deska_watches`
- `src/db/migrations-pg/0025_deska.sql`
- `src/app/api/deska/` — 7 route (search, documents, documents/[id], watches, poll, create-property, by-locality)
- `src/app/(dashboard)/deska/` — page + [id]
- `src/components/deska/` — category-badge, deska-card, deska-search, watch-manager
- `scripts/migrate-deska.ts`, `scripts/test-deska-api.ts`, `scripts/verify-deska.ts`

### Insolvence (ISIR rejstřík) — Phase 81
- `src/lib/isir/types.ts` — typy (IsirEventData, ApartmentData, InsolvencyScore)
- `src/lib/isir/isir-client.ts` — SOAP klient (getLastPodnetId, getEventData, fetchNewEvents, isApartmentCandidate, cleanXmlNamespaces, extractCourtFromSpis, extractDruhStavRizeni)
- `src/lib/isir/apartment-parser.ts` — PDF parsing (pdf-parse v2) + regex bytů (dispozice/plocha/adresa/LV/katastr/cena)
- `src/lib/isir/scorer.ts` — `scoreInsolvencyLead()`
- `src/db/schema/isir.ts` + `src/db/pg/isir.ts` — `insolvency_events` + `isir_polls`
- `src/db/migrations-pg/0026_isir.sql`
- `src/app/api/isir/` — cron, documents, documents/[id], polls
- `src/app/(dashboard)/isir/` — page + [id]
- `src/components/isir/` — insolvency-card, score-badge, section-badge
- `scripts/migrate-isir.ts`, `scripts/test-isir.ts`

### Realingo (premium feed) — Phase 82
- `src/lib/realingo/sync.ts` — `syncRealingo()` (hostněný sken + upsert; in-process volané cronem i triggerem)
- `src/lib/realingo/graphql-client.ts` — GraphQL klient (auth `REALINGO_EMAIL`/`REALINGO_PASSWORD`)
- `src/lib/realingo/realscan.ts`, `offers.ts`, `page-photos.ts`, `types.ts` — RealScan + nabídky s předstihem + fotky z veřejné HTML (fallback)
- `src/app/api/realingo/` — cron (Bearer), trigger (session, in-process), config (GET/POST + syncState), scans/[propertyId]
- UI badge: `RATING_VARIANT` + „Předstih" v `properties-explorer`, `properties/[id]`, `searches/[id]`, `dashboard`, `call-mode`, `leads` (lead-card/lead-drawer), settings

### Sdílené cron/trigger liby (Phase 83)
- `src/lib/ares/run-poll.ts` — `runAresPoll()` (sdílí ares cron + trigger)
- `src/lib/isir/run-poll.ts` — `runIsirPoll()` (sdílí isir cron + trigger)

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
- `lead-drawer.tsx` — rozdělen na `LeadDrawer` (overlay) + `LeadDrawerContent` (keyed per lead), stage-specific formuláře (meeting/offer/negotiation) ve `stageData`; detail ukazuje `ImageGallery` s listováním fotek (`propertyImageUrls`)

### Auth / Splash
- `src/components/auth/login-splash.tsx` — splash animace při přihlášení (video `public/realflip-animation.mp4`, 50 % vycentrované, navigace po prvním průchodu)
- `public/realflip-animation.mp4` + `realflip-animation-poster.jpg` (zdroj: `realflip animace 2.mov` — untracked)

### Nemovitosti (UI)
- `src/components/ui/properties-explorer.tsx` — řazení (9 režimů), odnímatelné filtry (chips)
- `src/components/ui/property-card.tsx` — mini-carousel fotek, meta řádek, hvězdička vedle skóre
- `src/components/ui/property-image.tsx` — fotky v boxech 8:5 bez ořezu
- `src/components/ui/image-gallery.tsx` — galerie s klávesovými šipkami + velkými klikacími zónami

### Dedup / Matching
- `src/lib/scraping/property-match.ts` — `parseAltPortals`, `appendAltPortal`, `hasAltUrl`, `toDbAltPortals` (alt_portals dedup)
- `src/lib/scraping/property-merge.ts` — merge duplicit respektující alt portály

### Investoři
- `src/app/(dashboard)/investors/page.tsx` + `[id]/page.tsx` — seznam karet + detail (projekty investora)
- `src/components/investors/investor-modal.tsx` (klíčovaný form), `edit-investor-button.tsx`
- `src/app/api/investors/route.ts`, `src/app/api/investors/[id]/route.ts`
- `src/components/portfolio/investor-selector.tsx` — změna financování na detailu projektu
- `src/lib/investors.ts` — `formatInvestorBudget`, `budgetCovers`
- `deals.investor_id` FK → investors (set null); null = "Sám financuji"

### API
- `src/app/api/scraping/trigger/route.ts`
- `src/app/api/searches/[id]/run/route.ts`
- `src/app/api/favorites/toggle/route.ts`
- `src/app/api/properties/[id]/calc-preset/route.ts`
- `src/app/api/properties/[id]/route.ts` — GET + PATCH (plocha/stav + žhavá re-analýza) + DELETE
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
- `src/lib/__tests__/geocode.test.ts` — cityKeyToName
- `src/lib/__tests__/quarter.test.ts` — sreality hash_id extrakce + čtvrti → quarter_id
- `src/lib/analysis/__tests__/analyzer-arv.test.ts`
- `src/lib/scraping/__tests__/adapters-image.test.ts`
- `src/lib/scraping/__tests__/filters.test.ts`
- `src/lib/scraping/__tests__/market-price-service.test.ts`
- `src/lib/scraping/__tests__/bazos-pagination.test.ts` — offset paginace URL
- `src/lib/scraping/__tests__/bezrealitky-parser.test.ts` — advert konverze + search parsing
