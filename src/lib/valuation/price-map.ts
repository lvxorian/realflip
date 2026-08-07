/**
 * Realizované prodejní ceny bytů — Seznam cenová mapa (sreality.cz/cenova-mapa).
 *
 * Dva zdroje dat:
 *  1. SSR stránka (sreality.cz/cenova-mapa) — dehydrated React Query data
 *     (PriceMapList → průměr per kraj, PriceMapGraph → měsíční trend). Slouží
 *     jako regionální hladina + trend.
 *  2. Veřejné API cenové mapy — GET /api/v1/price_map/list?category_main_cb=1&
 *     date_from=YYYY-MM&date_to=YYYY-MM&locality=<entity_type>,<entity_id>.
 *     Podporuje drill-down country → region → district → municipality → ward,
 *     takže pro konkrétní město (Cheb) dostaneme PŘESNÝ průměr obce, ne jen kraje.
 *     Stejný princip jako SSR: veřejné rozhraní stránky, zdarma, bez přihlášení.
 *
 * Cache: market_cache (segment price_map / price_map_district / price_map_municipality)
 * na 7 dní (transakce se aktualizují ~měsíčně) + memory cache.
 */

import { db } from "@/db";
import { marketCache } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { RateLimiter } from "@/lib/scraping/rate-limiter";
import { CITY_TO_REGION } from "@/lib/locality/crime";
import { cityNamesFor } from "@/lib/analysis/location";
import type { PriceMapData, PriceMapRegion, RealizedLevel, RealizedLocality, RegionKey, TrendPoint } from "./types";

const PAGE_URL = "https://www.sreality.cz/cenova-mapa";
const API_LIST = "https://www.sreality.cz/api/v1/price_map/list";

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

/** Memory cache pro drill-down (okresy/města) — klíč `district:<id>` / `municipality:<id>`. */
const drillMem = new Map<string, { items: DrillItem[]; fetchedAt: number }>();
const DRILL_MEM_TTL_MS = 6 * 60 * 60 * 1000;

/** Položka z API price_map (libovolná úroveň). */
interface DrillItem {
  entityId: number;
  entityType: string;
  name: string;
  seoName: string;
  avgPricePerSqm: number | null;
  numTransactions: number;
}

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

/** Vyčistí memory cache (SSR + drill-down) — pro testy a force refresh. */
export function clearPriceMapCache(): void {
  memCache = null;
  drillMem.clear();
}

/** Aktuální 12měsíční okno (date_to = minulý měsíc, date_from = 11 měsíců před ním). */
export function priceMapWindow(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const from = new Date(to.getFullYear(), to.getMonth() - 11, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}

// ---------- SSR parsing (regionální hladina + trend) ----------

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
    regions.push({
      regionKey: regionKeyFromName(name),
      name,
      avgPricePerSqm: avg,
      numTransactions: n,
      entityId: typeof loc.entityId === "number" ? loc.entityId : null,
    });
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
      // starší cache bez entityId by znemožnila drill-down do okresů → donuť čerstvý fetch
      if (!cached.regions.some((r) => r.entityId != null)) {
        return fetchPriceMap(true);
      }
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

// ---------- API drill-down (okresy → města) ----------

/** Fetch listu lokalit z API cenové mapy pro daný filtr. */
async function fetchDrill(locality: string, cacheSegment: string): Promise<DrillItem[] | null> {
  const { dateFrom, dateTo } = priceMapWindow();
  const url = `${API_LIST}?category_main_cb=1&date_from=${dateFrom}&date_to=${dateTo}&category=1&locality=${locality}`;

  // memory cache
  const mem = drillMem.get(locality);
  if (mem && Date.now() - mem.fetchedAt < DRILL_MEM_TTL_MS) return mem.items;

  // DB cache
  try {
    const row = await db
      .select({ payload: marketCache.payload, fetchedAt: marketCache.fetchedAt })
      .from(marketCache)
      .where(and(eq(marketCache.city, locality), eq(marketCache.segment, cacheSegment)))
      .limit(1)
      .then((r) => r[0]);
    if (row?.payload && Date.now() - Number(row.fetchedAt) < DB_TTL_MS) {
      const items = JSON.parse(row.payload) as DrillItem[];
      drillMem.set(locality, { items, fetchedAt: Date.now() });
      return items;
    }
  } catch {
    // fall through
  }

  await rateLimiter.wait("sreality", 3000);
  try {
    const res = await globalThis.fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    // API vrací snake_case — převedeme na camelCase DrillItem
    const json = (await res.json()) as {
      result?: { aggregated_list?: ({
        avg_price_per_sqm?: number | null;
        num_transactions?: number;
        locality?: { entity_id?: number; entity_type?: string; name?: string | null; seo_name?: string | null } | null;
      })[] };
    };
    const items: DrillItem[] = (json.result?.aggregated_list ?? [])
      .map((it) => ({
        entityId: it.locality?.entity_id ?? 0,
        entityType: it.locality?.entity_type ?? "",
        name: it.locality?.name ?? "",
        seoName: it.locality?.seo_name ?? "",
        avgPricePerSqm: it.avg_price_per_sqm ?? null,
        numTransactions: it.num_transactions ?? 0,
      }))
      .filter((it) => it.entityId > 0);
    drillMem.set(locality, { items, fetchedAt: Date.now() });
    try {
      await db
        .insert(marketCache)
        .values({
          city: locality,
          segment: cacheSegment,
          low: 0,
          high: 0,
          median: 0,
          sampleSize: items.length,
          source: "price_map",
          fetchedAt: Date.now(),
          payload: JSON.stringify(items),
        })
        .onConflictDoUpdate({
          target: [marketCache.city, marketCache.segment],
          set: { sampleSize: items.length, source: "price_map", fetchedAt: Date.now(), payload: JSON.stringify(items) },
        });
    } catch {
      // best-effort
    }
    return items;
  } catch (e) {
    console.error("Price map drill failed:", e);
    return null;
  }
}

/**
 * Najde položku v listu, jejíž jméno odpovídá názvu města (např. okres „Cheb" → město Cheb).
 * Pořadí shody: 1) seoName (normalizovaný slug, bezpečný), 2) přesné jméno, 3) substring.
 */
function findDrillItem(items: DrillItem[], cityKey: string, preferExactName: string | null): DrillItem | null {
  const names = cityNamesFor(cityKey)
    .map((n) => n.toLowerCase())
    .filter(Boolean);
  if (preferExactName) names.unshift(preferExactName.toLowerCase());

  // 1) seoName shoda (slugy jako "cheb", "karlovy-vary") — žádné falešné substringy
  const bySeo = items.filter((it) => names.some((n) => (it.seoName ?? "").toLowerCase() === n.replace(/\s+/g, "-")));
  if (bySeo.length === 1) return bySeo[0];
  if (bySeo.length > 1) return bySeo.sort((a, b) => b.numTransactions - a.numTransactions)[0];

  // 2) přesná shoda jména („Cheb" === „cheb")
  const exact = items.find((it) => names.some((n) => it.name?.toLowerCase() === n));
  if (exact) return exact;

  // 3) substring shoda s word-boundary — ochrana před krátkými falešnými shodami („aš")
  const bySub = items.filter((it) => {
    const name = it.name?.toLowerCase() ?? "";
    return names.some((n) => {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-záčďéěíňóřšťúůýž])${esc}($|[^a-záčďéěíňóřšťúůýž])`).test(name);
    });
  });
  if (bySub.length === 0) return null;
  return bySub.sort((a, b) => b.numTransactions - a.numTransactions)[0];
}

/**
 * Realizovaný průměr pro konkrétní město s drill-downem kraj → okres → obec.
 * Vrací nejpřesnější úroveň, která má data (obec > okres > kraj) + kontext vyšších úrovní.
 */
export async function getRealizedLocalityForCity(cityKey: string): Promise<RealizedLocality | null> {
  const regionKey = regionKeyForCity(cityKey);
  if (!regionKey) return null;

  const data = await fetchPriceMap();
  if (!data) return null;
  const region = data.regions.find((r) => r.regionKey === regionKey);
  if (!region || region.avgPricePerSqm <= 0) return null;

  const base: RealizedLocality = {
    avgPricePerSqm: region.avgPricePerSqm,
    numTransactions: region.numTransactions,
    regionName: region.name,
    regionAvgPricePerSqm: region.avgPricePerSqm,
    regionTransactions: region.numTransactions,
    districtName: null,
    districtAvgPricePerSqm: null,
    districtTransactions: null,
    localityName: null,
    entityType: "region",
    period: `${data.dateFrom} – ${data.dateTo}`,
    totalTransactions: data.totalTransactions,
  };

  if (!region.entityId) return base;

  // okresy kraje → najdi okres města (např. okres Cheb)
  const districts = await fetchDrill(`region,${region.entityId}`, "price_map_district");
  const district = districts ? findDrillItem(districts, cityKey, null) : null;

  if (district && district.numTransactions > 0 && district.avgPricePerSqm != null) {
    base.districtName = district.name;
    base.districtAvgPricePerSqm = district.avgPricePerSqm;
    base.districtTransactions = district.numTransactions;
    base.avgPricePerSqm = district.avgPricePerSqm;
    base.numTransactions = district.numTransactions;
    base.entityType = "district";
  }

  // obce okresu → najdi konkrétní město (Cheb)
  if (district) {
    const municipalities = await fetchDrill(`district,${district.entityId}`, "price_map_municipality");
    const municipality = municipalities ? findDrillItem(municipalities, cityKey, district.name) : null;
    if (municipality && municipality.numTransactions > 0 && municipality.avgPricePerSqm != null) {
      base.localityName = municipality.name;
      base.avgPricePerSqm = municipality.avgPricePerSqm;
      base.numTransactions = municipality.numTransactions;
      base.entityType = "municipality";
    }
  }

  return base;
}

/** Regionální realizovaný průměr pro město (jen kraj — fallback, historická kompatibilita). */
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
