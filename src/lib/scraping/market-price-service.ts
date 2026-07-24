import { db } from "@/db";
import { marketCache, properties } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { RateLimiter } from "./rate-limiter";
import { MARKET_DATA } from "@/lib/analysis/market-data";
import { CITY_ALIASES } from "@/lib/analysis/location";

interface MarketStats {
  low: number;
  high: number;
  median: number;
}

interface CachedData {
  city: string;
  low: number;
  high: number;
  median: number;
  sampleSize: number;
  source: "sreality_api" | "db" | "market_data";
  fetchedAt: number;
}

const MEMORY_TTL_MS = 15 * 60 * 1000;
const DB_TTL_MS = 24 * 60 * 60 * 1000;
const rateLimiter = RateLimiter.getInstance();
let memCache = new Map<string, CachedData>();

function computeStats(prices: number[]): { median: number; p25: number; p75: number } | null {
  if (prices.length < 3) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    median: sorted[Math.floor(n / 2)],
    p25: sorted[Math.floor(n / 4)],
    p75: sorted[Math.floor(3 * n / 4)],
  };
}

function toCacheEntry(city: string, stats: { median: number; p25: number; p75: number }, sampleSize: number, source: CachedData["source"]): CachedData {
  return {
    city,
    low: stats.p25,
    high: stats.p75,
    median: stats.median,
    sampleSize,
    source,
    fetchedAt: Date.now(),
  };
}

function marketDataFallback(cityKey: string): CachedData | null {
  const cityData = MARKET_DATA[cityKey];
  if (!cityData) return null;
  const segs = cityData.segments;
  const allLows = [segs.panel_needs_renov.low, segs.panel_renovated.low, segs.brick_needs_renov.low, segs.brick_renovated.low];
  const allHighs = [segs.panel_needs_renov.high, segs.panel_renovated.high, segs.brick_needs_renov.high, segs.brick_renovated.high];
  const medians = [
    (segs.panel_needs_renov.low + segs.panel_needs_renov.high) / 2,
    (segs.panel_renovated.low + segs.panel_renovated.high) / 2,
    (segs.brick_needs_renov.low + segs.brick_needs_renov.high) / 2,
    (segs.brick_renovated.low + segs.brick_renovated.high) / 2,
  ];
  const overallMedian = Math.round(medians.reduce((a, b) => a + b, 0) / medians.length);
  return {
    city: cityKey,
    low: Math.min(...allLows),
    high: Math.max(...allHighs),
    median: overallMedian,
    sampleSize: 0,
    source: "market_data",
    fetchedAt: Date.now(),
  };
}

async function fetchFromSrealityApi(cityKey: string): Promise<CachedData | null> {
  await rateLimiter.wait("sreality", 3000);
  const slug = cityKey.replace(/_/g, "-");
  const url = `https://www.sreality.cz/api/v1/estates/search?category_main_cb=1&category_type_cb=1&locality_district_cz=${slug}&limit=500&offset=0`;

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "cs,en;q=0.9",
    Referer: "https://www.sreality.cz/",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  };

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await globalThis.fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        if (res.status === 429 || res.status === 403) {
          const waitMs = res.status === 429 ? 30000 : 15000;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return null;
      }
      const data = await res.json();
      const items: any[] = data?.results ?? [];
      const prices = items
        .map((r: any) => r.price_czk_m2)
        .filter((p: number) => typeof p === "number" && p > 0);
      const stats = computeStats(prices);
      if (!stats) return null;
      return toCacheEntry(cityKey, stats, prices.length, "sreality_api");
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

async function fetchFromOwnDb(cityKey: string): Promise<CachedData | null> {
  const cityNames = [cityKey.replace(/_/g, " ")];
  for (const [alias, normalized] of Object.entries(CITY_ALIASES)) {
    if (normalized === cityKey) cityNames.push(alias);
  }

  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

  const rows = await db
    .select({ price: properties.price, area: properties.area, address: properties.address })
    .from(properties)
    .where(and(
      eq(properties.isActive, 1),
      gte(properties.lastSeen, ninetyDaysAgo),
    ))
    .limit(500);

  const pricePerSqms: number[] = [];
  for (const row of rows) {
    if (!row.area || row.area <= 0 || !row.price || row.price <= 0) continue;
    const addr = (row.address ?? "").toLowerCase();
    const matchesCity = cityNames.some((name) => addr.includes(name));
    if (!matchesCity) continue;
    pricePerSqms.push(Math.round(row.price / row.area));
  }

  const stats = computeStats(pricePerSqms);
  if (!stats) return null;
  return toCacheEntry(cityKey, stats, pricePerSqms.length, "db");
}

async function persistCache(entry: CachedData): Promise<void> {
  try {
    await db
      .insert(marketCache)
      .values({
        city: entry.city,
        low: entry.low,
        high: entry.high,
        median: entry.median,
        sampleSize: entry.sampleSize,
        source: entry.source,
        fetchedAt: entry.fetchedAt,
      })
      .onConflictDoUpdate({
        target: marketCache.city,
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

async function readFromDbCache(cityKey: string): Promise<CachedData | null> {
  try {
    const row = await db
      .select()
      .from(marketCache)
      .where(eq(marketCache.city, cityKey))
      .limit(1)
      .then((r) => r[0]);
    if (!row) return null;
    return {
      city: row.city,
      low: row.low,
      high: row.high,
      median: row.median,
      sampleSize: row.sampleSize,
      source: row.source as CachedData["source"],
      fetchedAt: row.fetchedAt,
    };
  } catch {
    return null;
  }
}

export async function refreshMarketData(cityKey: string): Promise<CachedData | null> {
  const apiData = await fetchFromSrealityApi(cityKey);
  if (apiData) {
    memCache.set(apiData.city, apiData);
    await persistCache(apiData);
    return apiData;
  }

  const dbData = await fetchFromOwnDb(cityKey);
  if (dbData) {
    memCache.set(dbData.city, dbData);
    await persistCache(dbData);
    return dbData;
  }

  const fallback = marketDataFallback(cityKey);
  if (fallback) {
    memCache.set(fallback.city, fallback);
    await persistCache(fallback);
  }
  return fallback;
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

export async function getMarketPriceRange(cityKey: string): Promise<MarketStats | null> {
  const cityData = MARKET_DATA[cityKey];
  if (!cityData) return null;

  const cached = memCache.get(cityKey);
  if (cached && Date.now() - cached.fetchedAt < MEMORY_TTL_MS) {
    return { low: cached.low, high: cached.high, median: cached.median };
  }

  const dbCached = await readFromDbCache(cityKey);
  if (dbCached && Date.now() - dbCached.fetchedAt < DB_TTL_MS) {
    memCache.set(dbCached.city, dbCached);
    return { low: dbCached.low, high: dbCached.high, median: dbCached.median };
  }

  return refreshMarketData(cityKey).then((r) => r ? { low: r.low, high: r.high, median: r.median } : null);
}

export function clearCache() {
  memCache.clear();
}
