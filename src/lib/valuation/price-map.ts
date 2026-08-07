/**
 * Realizované prodejní ceny bytů — Seznam cenová mapa (sreality.cz/cenova-mapa).
 *
 * Stránka je SSR (Next.js) a v HTML obsahuje dehydrated React Query data:
 *  - PriceMapList   → aggregatedList: průměrná cena Kč/m² + počet transakcí per kraj
 *                    (category=1 byty, posledních ~12 měsíců, zdroj ČÚZK + Seznam)
 *  - PriceMapGraph  → měsíční trend průměrné ceny Kč/m² (12 bodů)
 *
 * NEPOUŽÍVÁME žádné soukromé API endpointy — čteme jen veřejně vyrenderovaná data
 * stránky, která je zdarma a bez přihlášení (stejný princip jako sreality sitemap).
 * Data se cachují do market_cache (segment "price_map", city "cz") na 7 dní.
 */

import { db } from "@/db";
import { marketCache } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { RateLimiter } from "@/lib/scraping/rate-limiter";
import { CITY_TO_REGION } from "@/lib/locality/crime";
import type { PriceMapData, PriceMapRegion, RegionKey, TrendPoint } from "./types";

const PAGE_URL = "https://www.sreality.cz/cenova-mapa";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "cs,en;q=0.9",
  Referer: "https://www.sreality.cz/",
};

const rateLimiter = RateLimiter.getInstance();
const DB_TTL_MS = 7 * 24 * 60 * 60 * 1000; // transakce se aktualizují ~měsíčně
let memCache: { data: PriceMapData; fetchedAt: number } | null = null;
const MEM_TTL_MS = 60 * 60 * 1000;

/** Názvy krajů na stránce cenové mapy → naše region klíče (shodné s crime.ts). */
const REGION_NAME_TO_KEY: Record<string, string> = {
  "hlavni-mesto-praha": "praha",
  "stredocesky-kraj": "stredocesky",
  "jihocesky-kraj": "jihocesky",
  "plzensky-kraj": "plzensky",
  "karlovarsky-kraj": "karlovarsky",
  "ustecky-kraj": "ustecky",
  "liberecky-kraj": "liberecky",
  "kralovehradecky-kraj": "kralovehradecky",
  "pardubicky-kraj": "pardubicky",
  "vysocina": "vysocina",
  "jihomoravsky-kraj": "jihomoravsky",
  "olomoucky-kraj": "olomoucky",
  "zlinsky-kraj": "zlinsky",
  "moravskoslezsky-kraj": "moravskoslezsky",
};

/** cityKey → region klíč. */
export function regionKeyForCity(cityKey: string): string | null {
  return CITY_TO_REGION[cityKey as keyof typeof CITY_TO_REGION] ?? null;
}

function regionKeyFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  return REGION_NAME_TO_KEY[slug] ?? name;
}

/** Najde poslední `"data":{...}` před daným klíčem v SSR HTML a zparsuje objekt. */
function extractQueryData(html: string, key: string, lookback = 40000): Record<string, unknown> | null {
  const idx = html.indexOf(key);
  if (idx < 0) return null;
  const from = Math.max(0, idx - lookback);
  let dataIdx = -1;
  let search = from;
  while (true) {
    const m = html.indexOf('"data":{', search);
    if (m < 0 || m >= idx) break;
    dataIdx = m;
    search = m + 8;
  }
  if (dataIdx < 0) return null;
  let depth = 0;
  const start = dataIdx + 7; // za '"data":'
  for (let j = start; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, j + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Zparsuje `"graph":[{...}]` — měsíční trend z PriceMapGraph (poslední výskyt). */
function extractTrend(html: string): TrendPoint[] {
  const idx = html.lastIndexOf('"graph":');
  if (idx < 0) return [];
  let i = idx + '"graph":'.length;
  while (html[i] === " ") i++;
  if (html[i] !== "[") return [];
  let depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === "[") depth++;
    else if (html[j] === "]") {
      depth--;
      if (depth === 0) {
        try {
          const arr = JSON.parse(html.slice(i, j + 1)) as {
            price?: number;
            monthYear?: string;
            month?: string;
            year?: number;
          }[];
          return arr
            .filter((p) => typeof p.price === "number" && p.price > 0)
            .map((p) => ({
              monthYear: p.monthYear ?? `${String(p.year ?? 0)}/${String(p.month ?? "").padStart(2, "0")}`,
              price: Math.round(p.price!),
            }));
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

async function fetchPage(): Promise<string> {
  await rateLimiter.wait("sreality", 3000);
  const res = await globalThis.fetch(PAGE_URL, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Cenová mapa: HTTP ${res.status}`);
  return res.text();
}

function parseHtml(html: string, fetchedAt: number): PriceMapData {
  const list = extractQueryData(html, '"aggregatedList"');
  const aggregated = Array.isArray(list?.aggregatedList) ? (list.aggregatedList as Record<string, unknown>[]) : [];

  const regions: PriceMapRegion[] = [];
  let totalTransactions = 0;
  for (const item of aggregated) {
    const loc = (item.locality ?? {}) as Record<string, unknown>;
    const name = typeof loc.name === "string" ? loc.name : "";
    const avg = typeof item.avgPricePerSqm === "number" ? item.avgPricePerSqm : 0;
    const n = typeof item.numTransactions === "number" ? item.numTransactions : 0;
    if (!name || avg <= 0) continue;
    regions.push({ regionKey: regionKeyFromName(name), name, avgPricePerSqm: avg, numTransactions: n });
    totalTransactions += n;
  }

  // datumové okno z queryKey (category, dateFrom, dateTo) — fallback prázdné
  const dm = html.match(/"dateFrom":"([^"]+)"/);
  const dt = html.match(/"dateTo":"([^"]+)"/);
  const trend = extractTrend(html);

  return {
    regions,
    trend,
    dateFrom: dm?.[1] ?? "",
    dateTo: dt?.[1] ?? "",
    fetchedAt,
    totalTransactions,
  };
}

async function readCache(): Promise<PriceMapData | null> {
  try {
    const row = await db
      .select({ payload: marketCache.payload, fetchedAt: marketCache.fetchedAt })
      .from(marketCache)
      .where(and(eq(marketCache.city, "cz"), eq(marketCache.segment, "price_map")))
      .limit(1)
      .then((r) => r[0]);
    if (!row || !row.payload) return null;
    const d = JSON.parse(row.payload) as PriceMapData;
    if (Date.now() - Number(row.fetchedAt) > DB_TTL_MS) return null;
    return d;
  } catch {
    return null;
  }
}

async function persistCache(data: PriceMapData): Promise<void> {
  try {
    await db
      .insert(marketCache)
      .values({
        city: "cz",
        segment: "price_map",
        low: 0,
        high: 0,
        median: 0,
        sampleSize: data.regions.length,
        source: "price_map",
        fetchedAt: data.fetchedAt,
        payload: JSON.stringify(data),
      })
      .onConflictDoUpdate({
        target: [marketCache.city, marketCache.segment],
        set: { sampleSize: data.regions.length, source: "price_map", fetchedAt: data.fetchedAt, payload: JSON.stringify(data) },
      });
  } catch {
    // cache je best-effort
  }
}

/** Načte data cenové mapy (memory → DB cache → live fetch). Selhání vrací null. */
export async function fetchPriceMap(force = false): Promise<PriceMapData | null> {
  if (!force && memCache && Date.now() - memCache.fetchedAt < MEM_TTL_MS) {
    return memCache.data;
  }
  if (!force) {
    const cached = await readCache();
    if (cached) {
      memCache = { data: cached, fetchedAt: Date.now() };
      return cached;
    }
  }
  try {
    const html = await fetchPage();
    const data = parseHtml(html, Date.now());
    if (data.regions.length === 0) return null;
    memCache = { data, fetchedAt: Date.now() };
    persistCache(data).catch(() => {});
    return data;
  } catch (e) {
    console.error("Price map fetch failed:", e);
    return null;
  }
}

/** Regionální realizovaný průměr pro město. */
export async function getRealizedRegionForCity(cityKey: string): Promise<{
  avgPricePerSqm: number;
  numTransactions: number;
  regionName: string;
  period: string;
  totalTransactions: number;
} | null> {
  const regionKey = regionKeyForCity(cityKey);
  if (!regionKey) return null;
  const data = await fetchPriceMap();
  if (!data) return null;
  const region = data.regions.find((r) => r.regionKey === regionKey);
  if (!region || region.avgPricePerSqm <= 0) return null;
  return {
    avgPricePerSqm: region.avgPricePerSqm,
    numTransactions: region.numTransactions,
    regionName: region.name,
    period: `${data.dateFrom} – ${data.dateTo}`,
    totalTransactions: data.totalTransactions,
  };
}
