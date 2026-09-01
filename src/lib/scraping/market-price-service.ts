import { db } from "@/db";
import { marketCache, properties, realizedSales } from "@/db/schema";
import { REALIZED_SALE_TTL_MS } from "./sold-pairing";
import { eq, and, gte, desc } from "drizzle-orm";
import { RateLimiter } from "./rate-limiter";
import { getSrealitySitemapIds, pickSrealitySampleIds } from "./sreality-sitemap";
import {
  MARKET_DATA,
  conditionMultiplier,
  buildingTypeMultiplier,
  categoryMultiplier,
  hardcodedFallbackRange,
} from "@/lib/analysis/market-data";
import { cityNamesFor, addressMatchesCity } from "@/lib/analysis/location";
import { normalizeCondition } from "@/lib/analysis/condition";
import type { CitySegments } from "@/lib/analysis/types";

export type MarketSource = "db" | "sreality" | "market_data" | "fallback";

export interface MarketRangeResult {
  low: number;
  high: number;
  median: number;
  source: MarketSource;
  sampleSize: number;
}

export interface PropertyMarketContext {
  cityKey: string;
  lat?: number | null;
  lng?: number | null;
  condition?: string | null;
  buildingType?: string | null;
  area?: number | null;
  category?: string | null;
}

export type SegmentKey = keyof CitySegments | "any";

const SEGMENT_KEYS: SegmentKey[] = ["panel_needs_renov", "panel_renovated", "brick_needs_renov", "brick_renovated", "any"];

const MEMORY_TTL_MS = 15 * 60 * 1000;
const DB_TTL_MS = 24 * 60 * 60 * 1000;

const SREALITY_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "cs,en;q=0.9",
  Referer: "https://www.sreality.cz/",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

const rateLimiter = RateLimiter.getInstance();
const memCache = new Map<string, CachedEntry>();

interface CachedEntry {
  city: string;
  segment: string;
  low: number;
  high: number;
  median: number;
  sampleSize: number;
  source: string;
  fetchedAt: number;
}

export function segmentOf(condition: string | null | undefined, buildingType: string | null | undefined): SegmentKey {
  if (!condition || !buildingType) return "any";
  const needsRenov = condition === "original" || condition === "dilapidated";
  const isPanel = buildingType === "panel";
  if (isPanel && needsRenov) return "panel_needs_renov";
  if (isPanel) return "panel_renovated";
  if (needsRenov) return "brick_needs_renov";
  return "brick_renovated";
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function computeStats(prices: number[]): { median: number; p25: number; p75: number } | null {
  if (prices.length < 3) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    median: sorted[Math.floor(n / 2)],
    p25: sorted[Math.floor(n / 4)],
    p75: sorted[Math.floor((3 * n) / 4)],
  };
}

function toResult(stats: { median: number; p25: number; p75: number }, source: MarketSource, sampleSize: number): MarketRangeResult {
  return { low: stats.p25, high: stats.p75, median: stats.median, source, sampleSize };
}

/**
 * Robustní statistika — při ≥8 vzorcích odřízne 5 % nejlevnějších a 5 % nejdražších,
 * aby extrémní jednotky (garsonky za 250k/m², luxusní byty) netáhly medián.
 */
function trimmedPrices(prices: number[]): number[] {
  if (prices.length < 8) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const drop = Math.max(1, Math.round(sorted.length * 0.05));
  return sorted.slice(drop, Math.max(drop, sorted.length - drop));
}

function fromCacheEntry(e: CachedEntry): MarketRangeResult {
  return {
    low: e.low,
    high: e.high,
    median: e.median,
    source: e.source as MarketSource,
    sampleSize: e.sampleSize,
  };
}

/**
 * Cache segment rozšířený o GPS bucket (0,1° ≈ 8–11 km), když máme souřadnice.
 * Okruhové výsledky (5–10 km) pak nesdílí klíč s celoměstskými — jinak by
 * pořadí volání určovalo, jestli odhad dostane městský nebo lokální medián.
 * (Dříve 0,5° ≈ celá Praha — jeden záznam sloužil nesouvisejícím nemovitostem
 * a umožnil, aby se do odhadu dostal cizí medián, např. 204 598 Kč/m².)
 */
function cacheSegment(ctx: PropertyMarketContext, segment: string): string {
  let out = segment;
  if (ctx.lat != null && ctx.lng != null) {
    const latB = Math.round(ctx.lat * 10) / 10;
    const lngB = Math.round(ctx.lng * 10) / 10;
    out += `__g${latB}x${lngB}`;
  }
  // Plocha mění Tier-1 podmnožinu (filtr ±30 %) i-multiplikátor v segmentu
  // „any" — bez ní ve key by si deux nemovitosti se stejným GPS/segmentem,
  // ale různou plochou, navzájem kontaminovaly medián.
  if (ctx.area != null && ctx.area > 0) {
    const areaB = Math.round(ctx.area / 25) * 25;
    out += `__a${areaB}`;
  }
  // Multiplikátorový kontext se v segmentu „any" aplikuje na medián — kódujeme
  // HOLOUBITOU hodnotu adj (ne surová pole), aby si ji se stejným adj sdílely
  // i městské warm-up volby (getMarketPriceRange/refreshMarketData mají adj=1).
  if (segment === "any") {
    const adj = anyContextAdj(ctx);
    if (Math.abs(adj - 1) > 0.001) out += `__x${adj.toFixed(2)}`;
  }
  return out;
}

function cacheKey(city: string, segment: string): string {
  return `${city}__${segment}`;
}

/**
 * Multiplikátor aplikovaný na medián v segmentu „any" (Tier-1 i Tier-3 ho počítá
 * stejně — jedna definice, aby cache key a výsledek nemohly rozjet).
 */
function anyContextAdj(ctx: PropertyMarketContext): number {
  return (
    conditionMultiplier(ctx.condition ?? null) *
    buildingTypeMultiplier(ctx.buildingType ?? null) *
    categoryMultiplier(ctx.category ?? null)
  );
}

async function persistCache(entry: CachedEntry): Promise<void> {
  try {
    await db
      .insert(marketCache)
      .values({
        city: entry.city,
        segment: entry.segment,
        low: entry.low,
        high: entry.high,
        median: entry.median,
        sampleSize: entry.sampleSize,
        source: entry.source,
        fetchedAt: entry.fetchedAt,
        payload: null,
      })
      .onConflictDoUpdate({
        target: [marketCache.city, marketCache.segment],
        set: {
          low: entry.low,
          high: entry.high,
          median: entry.median,
          sampleSize: entry.sampleSize,
          source: entry.source,
          fetchedAt: entry.fetchedAt,
        },
      });
  } catch {
    // silent — cache persistence is best-effort
  }
}

async function readFromDbCache(cityKey: string, segment: string): Promise<CachedEntry | null> {
  try {
    const row = await db
      .select()
      .from(marketCache)
      .where(and(eq(marketCache.city, cityKey), eq(marketCache.segment, segment)))
      .limit(1)
      .then((r) => r[0]);
    if (!row) return null;
    return {
      city: row.city,
      segment: row.segment,
      low: row.low,
      high: row.high,
      median: row.median,
      sampleSize: row.sampleSize,
      source: row.source,
      fetchedAt: row.fetchedAt,
    };
  } catch {
    return null;
  }
}

// ---------- Tier 1: vlastní DB kompy ----------

export interface CompSample {
  pricePerSqm: number;
  lat: number | null;
  lng: number | null;
  area: number | null;
  segment: SegmentKey;
  address: string | null;
  price?: number | null;
  condition?: string | null;
  /** Pravdivá transakce z vlastní historie prodejů (párování zmizelých inzerátů). */
  realized?: boolean;
  /** Kdy byl prodej spárován (proxy data transakce). */
  soldAt?: number | null;
}

/**
 * Surové srovnatelné vzorky z vlastní DB (aktivní nabídky, posledních 90 dní)
 * + realizované prodeje z vlastní historie (párování zmizelých inzerátů, 12 měsíců).
 * Sdíleno kaskádou (Tier 1) i modulem Odhad (tabulka srovnatelných).
 */
export async function fetchComparableSamples(ctx: PropertyMarketContext): Promise<CompSample[]> {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

  const rows = await db
    .select({
      price: properties.price,
      area: properties.area,
      address: properties.address,
      lat: properties.lat,
      lng: properties.lng,
      condition: properties.condition,
      buildingType: properties.buildingType,
    })
    .from(properties)
    .where(and(eq(properties.isActive, 1), gte(properties.lastSeen, ninetyDaysAgo)))
    // deterministický výběr — bez ORDER BY by limit(1000) vzal libovolných
    // 1000 řádků (po growth DB by se do JS filtru nikdy nedostaly čerstvé)
    .orderBy(desc(properties.lastSeen))
    .limit(1000);

  const samples: CompSample[] = [];
  for (const row of rows) {
    if (!row.area || row.area <= 0 || !row.price || row.price <= 0) continue;
    samples.push({
      pricePerSqm: Math.round(row.price / row.area),
      lat: row.lat,
      lng: row.lng,
      area: row.area,
      segment: segmentOf(row.condition, row.buildingType),
      address: row.address,
      price: row.price,
      condition: row.condition,
    });
  }

  // Realizované prodeje z vlastní historie — skutečné transakce (posledních 12 měsíců).
  // Tyto vzorky mají vyšší vypovídací hodnotu než nabídky; engine je označí
  // jako „realizované prodeje" (source: realized) místo „nabídka".
  // Filtr TTL je v JS (ne SQL) — sdílená funkce je tak testovatelná bez mockování
  // drizzle where klauzulí a chování je stejné.
  try {
    const soldCutoff = Date.now() - REALIZED_SALE_TTL_MS;
    const soldRows = await db
      .select({
        price: realizedSales.price,
        area: realizedSales.area,
        address: realizedSales.address,
        lat: realizedSales.lat,
        lng: realizedSales.lng,
        condition: realizedSales.condition,
        buildingType: realizedSales.buildingType,
        soldAt: realizedSales.soldAt,
      })
      .from(realizedSales)
      // nejnovější prodeje první — bez ORDER BY by limit(500) mohl po růstu
      // historie minout všechna prodeje v TTL okně
      .orderBy(desc(realizedSales.soldAt))
      .limit(500);

    for (const row of soldRows) {
      if (!row.area || row.area <= 0 || !row.price || row.price <= 0) continue;
      if (row.soldAt == null || row.soldAt < soldCutoff) continue;
      samples.push({
        pricePerSqm: Math.round(row.price / row.area),
        lat: row.lat,
        lng: row.lng,
        area: row.area,
        segment: segmentOf(row.condition, row.buildingType),
        address: row.address,
        price: row.price,
        condition: row.condition,
        realized: true,
        soldAt: row.soldAt,
      });
    }
  } catch {
    // historie prodejů je doplněk — selhání nebrání komparacím
  }

  return samples;
}

async function fetchCompsForContext(ctx: PropertyMarketContext): Promise<MarketRangeResult | null> {
  const samples = await fetchComparableSamples(ctx);
  if (samples.length === 0) return null;

  const seg = segmentOf(ctx.condition, ctx.buildingType);
  const cityNames = cityNamesFor(ctx.cityKey);

  // Novostavby mají jinou cenovou hladinu a do statistik běžného fondu nepatří
  // (stejný princip jako Tier sreality). Luxusní/developerové vzorky by jinak
  // nafoukly medián (ověřeno na Praze: „new" inzeráty 174–187k Kč/m²).
  const existing = samples.filter((s) => s.condition !== "new");

  // Pro segment „any" aplikujeme multiplikátory stavu/typu/kategorie — medián
  // smíšeného vzorku je nad úrovní konkrétní nemovitosti (konzistence s Tier sreality).
  const adj = seg === "any" ? anyContextAdj(ctx) : 1;

  /** Ořez extrémů — mikro-byty (≤30 m²) a luxusní jednotky nesmí táhnout medián. */
  const areaOk = (s: CompSample): boolean =>
    (s.area == null || s.area >= 30) &&
    (minArea == null || (s.area != null && s.area >= minArea && s.area <= maxArea!));

  const statsFrom = (subset: CompSample[]): MarketRangeResult | null => {
    if (subset.length < 3) return null;
    // robustní statistika: při ≥8 vzorcích odřízneme 5 % nejdražších a 5 % nejlevnějších
    // (garsonky/luxus by jinak zkreslily medián — ověřeno: Praha „any" 18 vzorků → 204 598)
    const prices = trimmedPrices(subset.map((s) => s.pricePerSqm));
    if (prices.length < 3) return null;
    const stats = computeStats(prices);
    if (!stats) return null;
    // sampleSize = skutečně použitý počet (po ořezu extrémů) — transparentní číslo
    return toResult(
      { median: stats.median * adj, p25: stats.p25 * adj, p75: stats.p75 * adj },
      "db",
      prices.length
    );
  };

  const hasGps = ctx.lat != null && ctx.lng != null;
  const minArea = ctx.area != null ? ctx.area * 0.7 : null;
  const maxArea = ctx.area != null ? ctx.area * 1.3 : null;

  if (hasGps) {
    // a) do 5 km + segment + plocha ±30 % (novostavby vyloučeny)
    let subset = existing.filter(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        haversineKm(ctx.lat!, ctx.lng!, s.lat, s.lng) <= 5 &&
        (seg === "any" || s.segment === seg) &&
        areaOk(s)
    );
    if (subset.length >= 3) return statsFrom(subset);

    // b) do 10 km + segment + plocha ±30 % (stejná ochrana jako u 5 km — bez plošného
    // filtru sem prosakovaly garsonky a luxusní jednotky, které medián nafoukly)
    subset = existing.filter(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        haversineKm(ctx.lat!, ctx.lng!, s.lat, s.lng) <= 10 &&
        (seg === "any" || s.segment === seg) &&
        areaOk(s)
    );
    if (subset.length >= 3) return statsFrom(subset);
  }

  // c) město + segment
  let subset = existing.filter(
    (s) => addressMatchesCity(s.address, cityNames) && (seg === "any" || s.segment === seg) && areaOk(s)
  );
  if (subset.length >= 3) return statsFrom(subset);

  // d) město
  subset = existing.filter((s) => addressMatchesCity(s.address, cityNames) && areaOk(s));
  if (subset.length >= 3) return statsFrom(subset);

  return null;
}

// ---------- Tier 3: sitemap + detail API vzorky ----------

interface SrealitySample {
  city: string | null;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  condition: string | null;
  buildingType: string | null;
}

async function fetchSrealityDetail(id: number): Promise<SrealitySample | null> {
  await rateLimiter.wait("sreality", 3000);
  try {
    const res = await globalThis.fetch(`https://www.sreality.cz/api/v1/estates/${id}`, {
      headers: SREALITY_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.result;
    if (!r) return null;
    return {
      city: r.locality?.city ?? null,
      price: Math.round(r.price_czk ?? 0),
      pricePerSqm: r.price_czk_m2 ?? null,
      area: r.usable_area ?? r.floor_area ?? null,
      condition: normalizeCondition(r.building_condition?.name ?? null),
      buildingType: r.building_type?.name ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchSrealitySamples(cityKey: string): Promise<SrealitySample[] | null> {
  await getSrealitySitemapIds();
  const ids = pickSrealitySampleIds(cityKey, 300);
  if (ids.length === 0) return null;

  const cityNames = cityNamesFor(cityKey);
  const targetFetches = 80;

  const samples: SrealitySample[] = [];
  let fetched = 0;
  for (const id of ids) {
    if (fetched >= targetFetches) break;
    const s = await fetchSrealityDetail(id);
    fetched++;
    if (!s) continue;
    const c = (s.city ?? "").toLowerCase();
    if (!c || !cityNames.some((n) => c.includes(n.toLowerCase()))) continue;
    samples.push(s);
  }

  return samples.length >= 3 ? samples : null;
}

function statsFromSamples(
  samples: SrealitySample[],
  segment: SegmentKey,
  ctx: PropertyMarketContext
): MarketRangeResult | null {
  // Reálné byty se neprodávají pod 5 000 Kč/m² — odfiltruje podíly, dražby a chybná data
  const minPricePerSqm = 5000;
  const pricePerSqms = (s: SrealitySample): number | null => {
    let p = s.pricePerSqm;
    if ((p == null || p <= 0) && s.area && s.area > 0 && s.price > 0) p = Math.round(s.price / s.area);
    if (p == null || p <= 0) return null;
    return p >= minPricePerSqm ? p : null;
  };

  // Novostavby (sitemap je nadreprezentuje a mají jinou cenovou hladinu) do statistik
  // stávajícího fondu nepatří — zkreslují bytu "good/renovated". Z cílového pohledu
  // je to konzervativní (novostavba dostane hladinu stávajícího fondu).
  const existing = samples.filter((s) => s.condition !== "new");

  if (segment !== "any") {
    const segSamples = existing.filter((s) => segmentOf(s.condition, s.buildingType) === segment);
    const segPrices = segSamples
      .map(pricePerSqms)
      .filter((p): p is number => p != null && p > 0);
    const stats = computeStats(segPrices);
    if (stats) return toResult(stats, "sreality", segPrices.length);
  }

  const allPrices = existing.map(pricePerSqms).filter((p): p is number => p != null && p > 0);
  if (allPrices.length < 3) return null;
  const stats = computeStats(allPrices);
  if (!stats) return null;

  const adj = anyContextAdj(ctx);
  return {
    low: Math.round(stats.p25 * adj),
    high: Math.round(stats.p75 * adj),
    median: Math.round(stats.median * adj),
    source: "sreality",
    sampleSize: allPrices.length,
  };
}

// ---------- Tier 4: fixní MARKET_DATA (segment nemovitosti) ----------

function marketDataFallback(cityKey: string, segment: SegmentKey, category: string | null | undefined): MarketRangeResult | null {
  const cityData = MARKET_DATA[cityKey];
  if (!cityData) return null;
  const segs = cityData.segments;
  const cat = categoryMultiplier(category);

  const range = segment !== "any" ? segs[segment as keyof CitySegments] : null;
  if (range) {
    return {
      low: Math.round(range.low * cat),
      high: Math.round(range.high * cat),
      median: Math.round(((range.low + range.high) / 2) * cat),
      source: "market_data",
      sampleSize: 0,
    };
  }

  const lows = [segs.panel_needs_renov.low, segs.panel_renovated.low, segs.brick_needs_renov.low, segs.brick_renovated.low];
  const highs = [segs.panel_needs_renov.high, segs.panel_renovated.high, segs.brick_needs_renov.high, segs.brick_renovated.high];
  const mid = (Math.min(...lows) + Math.max(...highs)) / 2;
  return {
    low: Math.round(Math.min(...lows) * cat),
    high: Math.round(Math.max(...highs) * cat),
    median: Math.round(mid * cat),
    source: "market_data",
    sampleSize: 0,
  };
}

// ---------- Hlavní kaskáda ----------

function cacheResult(result: MarketRangeResult, cityKey: string, segment: string): void {
  const entry: CachedEntry = {
    city: cityKey,
    segment,
    low: result.low,
    high: result.high,
    median: result.median,
    sampleSize: result.sampleSize,
    source: result.source,
    fetchedAt: Date.now(),
  };
  memCache.set(cacheKey(cityKey, segment), entry);
  // Do 24h DB cache patří JEN městské statistiky bez per-property kontextu.
  // GPS-okruh (__g), plocha (__a) ani multiplikátor (__m) nesmí být persistovány —
  // jinak by jedna nemovitost kontaminovala sdílený medián dalším (Tier-1 kompy
  // se počítají levně z lokální tabulky, stačí 15min memory cache).
  const propertySpecific = segment.includes("__g") || segment.includes("__a") || segment.includes("__m");
  if (!propertySpecific) persistCache(entry).catch(() => {});
}

export async function getPropertyMarketRange(ctx: PropertyMarketContext, force = false, live = true): Promise<MarketRangeResult | null> {
  const segment = segmentOf(ctx.condition, ctx.buildingType);
  const seg = cacheSegment(ctx, segment);
  const key = cacheKey(ctx.cityKey, seg);

  if (!force) {
    const mem = memCache.get(key);
    if (mem && Date.now() - mem.fetchedAt < MEMORY_TTL_MS) return fromCacheEntry(mem);

    // Per-property klíče (__g GPS / __a plocha / __x multiplikátor) se v DB
    // nikdy nepersistují (viz cacheResult) — čtení i zápis musí používat stejný
    // predikát, jinak by property-specific klíč trefil cizí sdílený medián.
    const dbPersistable = !seg.includes("__g") && !seg.includes("__a") && !seg.includes("__x");
    if (dbPersistable) {
      const dbCached = await readFromDbCache(ctx.cityKey, seg);
      if (dbCached && Date.now() - dbCached.fetchedAt < DB_TTL_MS) {
        memCache.set(key, dbCached);
        return fromCacheEntry(dbCached);
      }
    }
  }

  // Tier 1: vlastní DB kompy (nejpřesnější — reálné vzorky včetně GPS)
  try {
    const dbStats = await fetchCompsForContext(ctx);
    if (dbStats) {
      cacheResult(dbStats, ctx.cityKey, seg);
      return dbStats;
    }
  } catch {
    // fall through
  }

  // Tier 2 byl odstraněn — sreality search API ignoruje locality_* parametry a vrací
  // celorepublikový feed (ověřeno 2026-08). Nahrazen Tierem 3 (sitemap + detail API),
  // který filtruje vzorky podle města správně.

  // Tier 3: sitemap + detail API vzorky (aktuální data pro libovolné město).
  // Při crawlu (live=false) se přeskočí — až 80 sreality fetchů × 3 s = 240 s
  // na JEDNO uložení inzerátu by rozbilo limit 60 s běhu. Tržní data se
  // doplní plánovanou úlohou (refreshAllMarketData), která volá live režim.
  if (live) {
    try {
      const samples = await fetchSrealitySamples(ctx.cityKey);
      if (samples) {
        const adj = anyContextAdj(ctx);
        for (const seg of SEGMENT_KEYS) {
          const st = statsFromSamples(samples, seg, ctx);
          if (st) {
            // „any" nese ctx-multiplikátor → persistej ho pod __x tagem jen když
            // adj≠1 (městské warm-up volání s adj=1 zůstávají na sdíleném klíči).
            const cacheSeg = seg === "any" && Math.abs(adj - 1) > 0.001 ? `any__x${adj.toFixed(2)}` : seg;
            cacheResult(st, ctx.cityKey, cacheSeg);
          }
        }
        const own = statsFromSamples(samples, segment, ctx);
        if (own) return own;
      }
    } catch {
      // fall through
    }
  }

  // Tier 4: fixní MARKET_DATA — konkrétní segment nemovitosti
  const md = marketDataFallback(ctx.cityKey, segment, ctx.category);
  if (md) {
    cacheResult(md, ctx.cityKey, seg);
    return md;
  }

  // Tier 5: hardcoded fallback — poslední záchrana
  const fb = hardcodedFallbackRange(ctx.condition ?? null, ctx.buildingType ?? null, ctx.category ?? null);
  const result: MarketRangeResult = {
    low: fb.low,
    high: fb.high,
    median: Math.round((fb.low + fb.high) / 2),
    source: "fallback",
    sampleSize: 0,
  };
  cacheResult(result, ctx.cityKey, seg);
  return result;
}

// Analyze ranges: tržní rozmezí pro aktuální stav + ARV rozmezí (segment "po rekonstrukci").
// ARV (hodnota po rekonstrukci) se musí počítat z renovovaného segmentu, ne ze segmentu
// aktuálního stavu (např. "original" => brick_needs_renov místo brick_renovated).
export async function getAnalysisRanges(
  ctx: PropertyMarketContext,
  live = true
): Promise<{ dynamicRange: MarketRangeResult | null; arvRange: MarketRangeResult | null }> {
  const needsRenov = ctx.condition === "original" || ctx.condition === "dilapidated";

  if (!needsRenov) {
    const dynamicRange = await getPropertyMarketRange(ctx, false, live).catch(() => null);
    return { dynamicRange, arvRange: dynamicRange };
  }

  const [dynamicRange, arvRange] = await Promise.all([
    getPropertyMarketRange(ctx, false, live).catch(() => null),
    getPropertyMarketRange({ ...ctx, condition: "renovated" }, false, live).catch(() => null),
  ]);
  return { dynamicRange, arvRange };
}

export async function getMarketPriceRange(cityKey: string): Promise<MarketRangeResult | null> {
  return getPropertyMarketRange({ cityKey, category: "stable" });
}

export async function refreshMarketData(cityKey: string): Promise<MarketRangeResult | null> {
  return getPropertyMarketRange({ cityKey, category: "stable" }, true);
}

export async function refreshAllMarketData(): Promise<number> {
  const cities = Object.keys(MARKET_DATA);
  let count = 0;
  for (const city of cities) {
    const result = await refreshMarketData(city);
    if (result) count++;
  }
  return count;
}

export function clearCache() {
  memCache.clear();
}
