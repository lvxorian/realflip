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
import { eq, and, desc } from "drizzle-orm";
import { RateLimiter } from "@/lib/scraping/rate-limiter";
import { CITY_TO_REGION } from "@/lib/locality/crime";
import { cityNamesFor } from "@/lib/analysis/location";
import type { AddressTransaction, PriceMapData, PriceMapRegion, RealizedLevel, RealizedLocality, RegionKey, TrendPoint } from "./types";

const PAGE_URL = "https://www.sreality.cz/cenova-mapa";
const API_LIST = "https://www.sreality.cz/api/v1/price_map/list";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "cs,en;q=0.9",
  Referer: "https://www.sreality.cz/",
};

const rateLimiter = RateLimiter.getInstance();
// Regionální hladina se aktualizuje ~měsíčně, ale stará DB cache způsobovala
// nestabilní výsledky (uživatel dostal kraj 112 430, přestože stránka už vrací 149 906).
// TTL 1 den omezí rozsah zastaralosti; drill-down (okres/obec/čtvrť) je hlavní zdroj.
const DB_TTL_MS = 24 * 60 * 60 * 1000;
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

/** Kontext pro drill-down na městskou čtvrť (ward) — adresa a/nebo GPS + hinty z reverse geokódu. */
export interface RealizedContext {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Názvy čtvrtí („Žižkov", „Praha 3") z reverse geokódu Nominatimu — server-only. */
  wardHints?: string[] | null;
  /** Okno realizovaných prodejů v měsících (6/12/24) — default 12. */
  lookbackMonths?: number | null;
  /** Datum odhadu „k datu" (YYYY-MM) — okno končí tímto měsícem (zpětný odhad). */
  asOfDate?: string | null;
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

/**
 * Okno realizovaných prodejů (date_to = minulý měsíc, date_from = (months-1) měsíců před ním).
 * Big-city s velkou likviditou (Praha, Brno…) lépe ocení i kratší okno 6 měsíců —
 * ceny z posledního půl roku jsou relevantnější (Valuo používá ~6M). Malá města
 * potřebují 12–24M kvůli nízkému počtu transakcí.
 */
export function priceMapWindow(
  months: number = 12,
  asOfDate?: string | null
): { dateFrom: string; dateTo: string } {
  const now = new Date();
  // datum odhadu „k datu": okno končí zvoleným měsícem místo „nyní"
  let toYear = now.getFullYear();
  let toMonth = now.getMonth();
  if (asOfDate && /^\d{4}-\d{2}$/.test(asOfDate)) {
    const [y, m] = asOfDate.split("-").map(Number);
    if (y >= 2000 && y <= now.getFullYear() + 1 && m >= 1 && m <= 12) {
      toYear = y;
      toMonth = m - 1;
    }
  }
  const to = new Date(toYear, toMonth - 1, 1); // minulý měsíc
  const from = new Date(to.getFullYear(), to.getMonth() - (months - 1), 1);
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
  // jeden retry — síť/proxy výpadky nesmí shodit odhad
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await rateLimiter.wait("sreality", 3000);
      const res = await globalThis.fetch(PAGE_URL, {
        headers: HEADERS,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Cenová mapa: HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Cenová mapa: fetch selhal");
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

/** Plausibilita regionálního listu — stará/korupovaná cache nesmí shodit odhad. */
function plausibleRegions(d: PriceMapData | null): boolean {
  if (!d || !Array.isArray(d.regions) || d.regions.length === 0) return false;
  // reálná stránka má 14 krajů; kontrola polí chytí korupci a neúplné záznamy
  return d.regions.every((r) => r.avgPricePerSqm > 5000 && r.avgPricePerSqm < 500000 && r.entityId != null);
}

async function readCache(): Promise<PriceMapData | null> {
  try {
    const row = await db
      .select({ payload: marketCache.payload, fetchedAt: marketCache.fetchedAt })
      .from(marketCache)
      .where(and(eq(marketCache.city, "cz"), eq(marketCache.segment, "price_map")))
      .orderBy(desc(marketCache.fetchedAt))
      .limit(1)
      .then((r) => r[0]);
    if (!row || !row.payload) return null;
    if (Date.now() - Number(row.fetchedAt) > DB_TTL_MS) return null;
    const d = JSON.parse(row.payload) as PriceMapData;
    // korupovaná / neúplná cache (bez entityId, málo krajů, nesmyslné ceny) → obnovit
    if (!plausibleRegions(d)) return null;
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
    if (!plausibleRegions(data)) {
      console.error("Price map parse produced implausible region list — ignored");
      return null;
    }
    memCache = { data, fetchedAt: Date.now() };
    persistCache(data).catch(() => {});
    return data;
  } catch (e) {
    console.error("Price map fetch failed:", e);
    return null;
  }
}

// ---------- API drill-down (okresy → města) ----------

/**
 * Fetch listu lokalit z API cenové mapy pro daný filtr.
 * Okno (months) se propisuje do URL i do cache segmentu — 6M a 12M výsledky
 * se nesmí míchat (jinak by odhad závisel na tom, kdo cache zapsal první).
 */
async function fetchDrill(
  locality: string,
  cacheSegment: string,
  months: number = 12,
  asOfDate?: string | null
): Promise<DrillItem[] | null> {
  const { dateFrom, dateTo } = priceMapWindow(months, asOfDate);
  const url = `${API_LIST}?category_main_cb=1&date_from=${dateFrom}&date_to=${dateTo}&category=1&locality=${locality}`;

  const segKey = `${cacheSegment}_${months}m${asOfDate ? "_" + asOfDate : ""}`;

  // memory cache
  const mem = drillMem.get(`${locality}|${segKey}`);
  if (mem && Date.now() - mem.fetchedAt < DRILL_MEM_TTL_MS) return mem.items;

  // DB cache (seřazeno od nejnovějšího — ochrana proti duplicitním řádkům bez PK)
  try {
    const row = await db
      .select({ payload: marketCache.payload, fetchedAt: marketCache.fetchedAt })
      .from(marketCache)
      .where(and(eq(marketCache.city, locality), eq(marketCache.segment, segKey)))
      .orderBy(desc(marketCache.fetchedAt))
      .limit(1)
      .then((r) => r[0]);
    if (row?.payload && Date.now() - Number(row.fetchedAt) < DB_TTL_MS) {
      const items = JSON.parse(row.payload) as DrillItem[];
      // prázdný/neplatný list = kdysi špatná odpověď → nesmí blokovat čerstvý fetch
      if (Array.isArray(items) && items.length > 0) {
        drillMem.set(`${locality}|${segKey}`, { items, fetchedAt: Date.now() });
        return items;
      }
    }
  } catch {
    // fall through
  }

  // jeden retry — přechodný výpadek API nesmí shodit drill-down na krajskou úroveň
  for (let attempt = 0; attempt < 2; attempt++) {
    await rateLimiter.wait("sreality", 3000);
    try {
      const res = await globalThis.fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        if (attempt === 0) continue;
        return null;
      }
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
      drillMem.set(`${locality}|${segKey}`, { items, fetchedAt: Date.now() });
      try {
        await db
          .insert(marketCache)
          .values({
            city: locality,
            segment: segKey,
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
      if (attempt === 0) continue;
      console.error("Price map drill failed:", e);
      return null;
    }
  }
  return null;
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

/** Normalizace názvu pro shodu čtvrtí (bez diakritiky, malými, pomlčky). */
function normWardName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Najde městskou čtvrť (ward) podle hintů — reverse geokód (Nominatim quarter/suburb)
 * a segmenty adresy („Žižkov", „Praha 3-Žižkov"). Pořadí: seoName/jméno shoda → substring.
 */
function findWardByHints(items: DrillItem[], ctx: RealizedContext): DrillItem | null {
  const raw: string[] = [...(ctx.wardHints ?? [])];
  if (ctx.address) {
    for (const seg of ctx.address.split(",")) {
      const t = seg.trim();
      if (t.length >= 3 && !/^\d+$/.test(t)) raw.push(t);
    }
  }
  const hints = raw.map(normWardName).filter((h) => h.length >= 3);
  if (hints.length === 0) return null;

  for (const h of hints) {
    const bySeo = items.filter((it) => normWardName(it.seoName) === h);
    if (bySeo.length > 0) return bySeo.sort((a, b) => b.numTransactions - a.numTransactions)[0];
    const byName = items.filter((it) => normWardName(it.name) === h);
    if (byName.length > 0) return byName.sort((a, b) => b.numTransactions - a.numTransactions)[0];
  }
  for (const h of hints) {
    if (h.length < 5) continue;
    const bySub = items.filter((it) => {
      const n = normWardName(it.name);
      return n.includes(h) || h.includes(n);
    });
    if (bySub.length > 0) return bySub.sort((a, b) => b.numTransactions - a.numTransactions)[0];
  }
  return null;
}

/**
 * Realizovaný průměr pro konkrétní město s drill-downem kraj → okres → obec → čtvrť.
 * Vrací nejpřesnější úroveň, která má data (čtvrť > obec > okres > kraj) + kontext vyšších úrovní.
 * Praha (region → rovnou čtvrti) a obec → čtvrť se vyhodnocují jen s adresou/GPS (ctx),
 * jinak zůstává obec/okres/kraj — čtvrť bez adresy by byla náhodná.
 */
export async function getRealizedLocalityForCity(
  cityKey: string,
  ctx: RealizedContext = {}
): Promise<RealizedLocality | null> {
  const regionKey = regionKeyForCity(cityKey);
  if (!regionKey) return null;

  const data = await fetchPriceMap();
  if (!data) return null;
  const region = data.regions.find((r) => r.regionKey === regionKey);
  if (!region || region.avgPricePerSqm <= 0) return null;

  const months = ctx.lookbackMonths === 6 || ctx.lookbackMonths === 24 ? ctx.lookbackMonths : 12;
  // perioda dle skutečně použitého okna (6/12/24M a případného data odhadu) —
  // ne dle 12M okna SSR stránky, které se používá jen pro krajskou hladinu
  const window = priceMapWindow(months, ctx.asOfDate);
  const period = `${window.dateFrom} – ${window.dateTo}`;

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
    localityAvgPricePerSqm: null,
    localityTransactions: null,
    wardName: null,
    wardAvgPricePerSqm: null,
    wardTransactions: null,
    entityType: "region",
    period,
    totalTransactions: data.totalTransactions,
  };

  if (!region.entityId) return base;

  // Úroveň 1: children regionu — Praha vrací rovnou čtvrti (ward), ostatní kraje okresy.
  const lvl1 = await fetchDrill(`region,${region.entityId}`, "price_map_district", months, ctx.asOfDate);
  if (!lvl1 || lvl1.length === 0) return base;

  const wardCount = lvl1.filter((i) => i.entityType === "ward").length;
  const isWardLevel = wardCount > lvl1.length / 2;

  if (isWardLevel) {
    // Praha: region → čtvrti. Bez adresy/hintů nemůžeme čtvrť určit → zůstává kraj.
    const ward = findWardByHints(lvl1, ctx);
    if (ward && ward.numTransactions > 0 && ward.avgPricePerSqm != null) {
      base.wardName = ward.name;
      base.wardId = ward.entityId;
      base.wardAvgPricePerSqm = ward.avgPricePerSqm;
      base.wardTransactions = ward.numTransactions;
      base.avgPricePerSqm = ward.avgPricePerSqm;
      base.numTransactions = ward.numTransactions;
      base.entityType = "ward";
    }
    return base;
  }

  // Ostatní kraje: okresy → obec → čtvrti (čtvrti jen s adresou).
  const district = findDrillItem(lvl1, cityKey, null);

  if (district && district.numTransactions > 0 && district.avgPricePerSqm != null) {
    base.districtName = district.name;
    base.districtAvgPricePerSqm = district.avgPricePerSqm;
    base.districtTransactions = district.numTransactions;
    base.avgPricePerSqm = district.avgPricePerSqm;
    base.numTransactions = district.numTransactions;
    base.entityType = "district";
  }

  if (district) {
    const municipalities = await fetchDrill(
      `district,${district.entityId}`,
      "price_map_municipality",
      months,
      ctx.asOfDate
    );
    const municipality = municipalities ? findDrillItem(municipalities, cityKey, district.name) : null;
    if (municipality && municipality.numTransactions > 0 && municipality.avgPricePerSqm != null) {
      base.localityName = municipality.name;
      base.localityAvgPricePerSqm = municipality.avgPricePerSqm;
      base.localityTransactions = municipality.numTransactions;
      base.avgPricePerSqm = municipality.avgPricePerSqm;
      base.numTransactions = municipality.numTransactions;
      base.entityType = "municipality";

      // čtvrti obce (např. Brno-střed, Liberec-centrum) — jen s adresou a jen když
      // obecní průměr není už tak robustní, že by čtvrť nic nezlepšila (ušetří 3 s rate-limit)
      const hasHints = (ctx.wardHints?.length ?? 0) > 0 || Boolean(ctx.address?.trim());
      if (hasHints && municipality.numTransactions < 2500) {
        const wards = await fetchDrill(
          `municipality,${municipality.entityId}`,
          "price_map_ward",
          months,
          ctx.asOfDate
        );
        const ward = wards ? findWardByHints(wards, ctx) : null;
        if (ward && ward.numTransactions > 0 && ward.avgPricePerSqm != null) {
          base.wardName = ward.name;
          base.wardId = ward.entityId;
          base.wardAvgPricePerSqm = ward.avgPricePerSqm;
          base.wardTransactions = ward.numTransactions;
          base.avgPricePerSqm = ward.avgPricePerSqm;
          base.numTransactions = ward.numTransactions;
          base.entityType = "ward";
        }
      }
    }
  }

  return base;
}

// ---------- Adresní transakce (estate_list) ----------

/** Memory cache pro adresní transakce — klíč `ward:<id>|<okno>`. */
const txMem = new Map<string, { items: AddressTransaction[]; fetchedAt: number }>();
const TX_MEM_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Adresní transakce čtvrti z cenové mapy (estate_list).
 * Jednotlivé realizované prodeje s přesným GPS, č.p., velikostní kategorií a datem.
 * Cena per transakce NENÍ veřejně dostupná (ČÚZK anonymizuje) — proto se vrací
 * jen jako komparace, ne jako cenový zdroj.
 *
 * Vrací [] když: čtvrť se nenalézá (bez adresy), ward nemá data, nebo API selže.
 * Nevyhazuje — volající (engine) ji bere jako doplňkový kontext.
 */
export async function fetchWardTransactions(
  cityKey: string,
  ctx: RealizedContext = {}
): Promise<AddressTransaction[]> {
  // 1) najdi čtvrť (ward) — bez adresy/hintů Praha zůstává na kraji → žádné transakce
  const locality = await getRealizedLocalityForCity(cityKey, ctx);
  if (!locality || !locality.wardId) return [];

  const months = ctx.lookbackMonths === 6 || ctx.lookbackMonths === 24 ? ctx.lookbackMonths : 12;
  const window = priceMapWindow(months, ctx.asOfDate);
  const url = `${API_LIST}?category_main_cb=1&date_from=${window.dateFrom}&date_to=${window.dateTo}&category=1&locality=ward,${locality.wardId}`;
  const segKey = `price_map_ward_tx_${months}m${ctx.asOfDate ? "_" + ctx.asOfDate : ""}`;
  const memKey = `${locality.wardId}|${segKey}`;

  // memory cache
  const mem = txMem.get(memKey);
  if (mem && Date.now() - mem.fetchedAt < TX_MEM_TTL_MS) return mem.items;

  // DB cache. Klíč `ward,<id>` je bezpečný, protože entity ID cenové mapy jsou
  // globálně unikátní (společný registry — country 112, region 10, ward 14971…),
  // takže `ward,13715` nemůže kolidovat s wardou jiné obce ani s drill cache
  // (segment price_map_ward_tx_* se liší od price_map_district/municipality/ward_*).

  // DB cache
  try {
    const row = await db
      .select({ payload: marketCache.payload, fetchedAt: marketCache.fetchedAt })
      .from(marketCache)
      .where(and(eq(marketCache.city, `ward,${locality.wardId}`), eq(marketCache.segment, segKey)))
      .orderBy(desc(marketCache.fetchedAt))
      .limit(1)
      .then((r) => r[0]);
    if (row?.payload && Date.now() - Number(row.fetchedAt) < DB_TTL_MS) {
      const items = JSON.parse(row.payload) as AddressTransaction[];
      if (Array.isArray(items) && items.length > 0) {
        txMem.set(memKey, { items, fetchedAt: Date.now() });
        return items;
      }
    }
  } catch {
    // fall through
  }

  // live fetch (jeden retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    await rateLimiter.wait("sreality", 3000);
    try {
      const res = await globalThis.fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        if (attempt === 0) continue;
        return [];
      }
      const json = (await res.json()) as {
        result?: { estate_list?: EstateApiItem[] };
      };
      const items = parseEstateList(json.result?.estate_list ?? []);
      // prázdný list se NECACHEUJE — čtvrť bez adresních dat se zkusí znovu příště
      // (krátkodobý prázdný marker by riskoval, že nové transakce čtvrť nedostanou)
      if (items.length === 0) return [];

      txMem.set(memKey, { items, fetchedAt: Date.now() });
      try {
        await db
          .insert(marketCache)
          .values({
            city: `ward,${locality.wardId}`,
            segment: segKey,
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
      if (attempt === 0) continue;
      console.error("Price map ward transactions failed:", e);
      return [];
    }
  }
  return [];
}

/** Surová položka estate_list z API (snake_case). */
interface EstateApiItem {
  transaction_id?: number | null;
  currency?: string | null;
  title?: string | null;
  validation_date?: string | null;
  locality?: {
    address_id?: number | null;
    gps_lat?: number | null;
    gps_lon?: number | null;
    housenumber?: string | null;
    municipality?: string | null;
    ward?: string | null;
    ward_id?: number | null;
  } | null;
}

/** Převod surových estate položek na naše AddressTransaction + plausibility filtr. */
export function parseEstateList(raw: EstateApiItem[]): AddressTransaction[] {
  const out: AddressTransaction[] = [];
  for (const e of raw) {
    // transakce bez ID neexistují — 0 by kolidovalo v dedup/identifikaci komparací
    if (!e.transaction_id) continue;
    const loc = e.locality ?? {};
    const lat = typeof loc.gps_lat === "number" ? loc.gps_lat : null;
    const lng = typeof loc.gps_lon === "number" ? loc.gps_lon : null;
    // plausibilita GPS (ČR: 48.5–51.1 N, 12–19 E) — chrání před korupcí
    if (lat != null && lng != null && (lat < 48.4 || lat > 51.2 || lng < 12 || lng > 19)) continue;
    out.push({
      transactionId: e.transaction_id,
      addressId: loc.address_id ?? null,
      housenumber: loc.housenumber ?? null,
      lat,
      lng,
      municipality: loc.municipality ?? null,
      ward: loc.ward ?? null,
      wardId: loc.ward_id ?? null,
      areaCategory: e.title ?? null,
      validationDate: e.validation_date ?? null,
    });
  }
  return out;
}

/** Vyčistí memory cache adresních transakcí (testy / force refresh). */
export function clearWardTxCache(): void {
  txMem.clear();
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
