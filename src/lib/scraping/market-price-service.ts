import { RateLimiter } from "./rate-limiter";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { CITY_ALIASES } from "@/lib/analysis/location";

interface MarketStats {
  low: number;
  high: number;
  median: number;
}

interface CachedMarketData {
  city: string;
  source: "sreality" | "db";
  medianPricePerSqm: number;
  p25PricePerSqm: number;
  p75PricePerSqm: number;
  sampleSize: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const rateLimiter = RateLimiter.getInstance();
let memoryCache: Map<string, CachedMarketData> = new Map();

function computeStats(pricePerSqms: number[]): { median: number; p25: number; p75: number } | null {
  if (pricePerSqms.length < 3) return null;
  const sorted = [...pricePerSqms].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    median: sorted[Math.floor(n / 2)],
    p25: sorted[Math.floor(n / 4)],
    p75: sorted[Math.floor(3 * n / 4)],
  };
}

function cacheAndReturn(data: CachedMarketData): MarketStats {
  memoryCache.set(data.city, data);
  return { low: data.p25PricePerSqm, high: data.p75PricePerSqm, median: data.medianPricePerSqm };
}

// ── Layer 1: Sreality HTML search page (location-filtered, __NEXT_DATA__) ──

async function fetchWithRetry(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "cs,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return res.text();
    } catch {
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return null;
}

function extractNextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function extractPricesFromNextData(data: any): number[] {
  const queries = data.props?.pageProps?.dehydratedState?.queries ?? [];
  const searchQuery = queries.find((q: any) => q.queryKey?.[0] === "estatesSearch");
  if (!searchQuery) return [];
  const results = searchQuery.state?.data?.results ?? [];
  return results
    .map((r: any) => r.priceCzkPerSqM ?? r.price_czk_m2)
    .filter((p: number) => typeof p === "number" && p > 0);
}

async function fetchFromSreality(cityKey: string): Promise<CachedMarketData | null> {
  await rateLimiter.wait("sreality", 3000);
  const slug = cityKey.replace(/_/g, "-");
  const html = await fetchWithRetry(`https://www.sreality.cz/hledani/prodej/byty/${slug}`);
  if (!html) return null;
  const data = extractNextData(html);
  if (!data) return null;
  const prices = extractPricesFromNextData(data);
  const stats = computeStats(prices);
  if (!stats) return null;
  return {
    city: cityKey,
    source: "sreality",
    medianPricePerSqm: stats.median,
    p25PricePerSqm: stats.p25,
    p75PricePerSqm: stats.p75,
    sampleSize: prices.length,
    fetchedAt: Date.now(),
  };
}

// ── Layer 2: Own DB (recent scraped listings in the same city) ──

async function fetchFromLocalDb(cityKey: string): Promise<CachedMarketData | null> {
  const cityNames = [cityKey.replace(/_/g, " ")];
  for (const [alias, normalized] of Object.entries(CITY_ALIASES)) {
    if (normalized === cityKey) cityNames.push(alias);
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ price: properties.price, area: properties.area, address: properties.address })
    .from(properties)
    .where(and(
      eq(properties.isActive, 1),
      gte(properties.lastSeen, thirtyDaysAgo),
    ))
    .limit(200);

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

  return {
    city: cityKey,
    source: "db",
    medianPricePerSqm: stats.median,
    p25PricePerSqm: stats.p25,
    p75PricePerSqm: stats.p75,
    sampleSize: pricePerSqms.length,
    fetchedAt: Date.now(),
  };
}

// ── Main entry point ──

export async function getMarketPriceRange(
  cityKey: string
): Promise<MarketStats | null> {
  // Check cache first
  const cached = memoryCache.get(cityKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { low: cached.p25PricePerSqm, high: cached.p75PricePerSqm, median: cached.medianPricePerSqm };
  }

  // Layer 1: Sreality live data
  const srealityData = await fetchFromSreality(cityKey);
  if (srealityData) return cacheAndReturn(srealityData);

  // Layer 2: Own DB
  const dbData = await fetchFromLocalDb(cityKey);
  if (dbData) return cacheAndReturn(dbData);

  // Layer 3: null → caller falls back to MARKET_DATA
  return null;
}

export function clearCache() {
  memoryCache.clear();
}
