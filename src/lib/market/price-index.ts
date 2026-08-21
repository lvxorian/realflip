import { db } from "@/db";
import { properties, propertyAnalysis, priceHistory, marketCache } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IndexPoint {
  period: string;
  value: number;
}

export interface SegmentIndex {
  key: string;
  label: string;
  current: number; // Kč/m² (medián)
  indexValue: number; // base 100
  sampleSize: number;
  changePct: number | null; // vs. předchozí záznam
}

export interface PriceIndexResult {
  segments: SegmentIndex[];
  marketTrend: number | null; // meziroční změna celého trhu (%)
  points: IndexPoint[];
}

type SegmentKey = "byty" | "byty_panel" | "byty_cihla" | "domy";

const SEGMENT_DEFS: { key: SegmentKey; label: string }[] = [
  { key: "byty", label: "Byty" },
  { key: "byty_panel", label: "Byty — panel" },
  { key: "byty_cihla", label: "Byty — cihla" },
  { key: "domy", label: "Domy" },
];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Odstraní odlehlé hodnoty (IQR metoda) pro robustní medián. */
function removeOutliers(values: number[]): number[] {
  if (values.length < 5) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 4)];
  const q3 = sorted[Math.floor((3 * sorted.length) / 4)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((v) => v >= lo && v <= hi);
}

function detectSegment(buildingType: string | null, title: string | null): SegmentKey {
  const t = (title ?? "").toLowerCase();
  if (/d[ůu]m|rodinn/.test(t)) return "domy";
  if (buildingType === "panel") return "byty_panel";
  if (buildingType === "brick" || buildingType === "mixed") return "byty_cihla";
  if (/byt|apartm/.test(t)) return "byty";
  return "byty";
}

/**
 * Cenový index RealFlip (spotřební koš dle Valuo INDEX metodiky).
 * Base = 100 pro nejstarší dostupné období. Aktuální hodnota = medián ceny/m².
 */
export async function computePriceIndex(): Promise<PriceIndexResult> {
  const props = await db
    .select({
      id: properties.id,
      price: properties.price,
      area: properties.area,
      pricePerSqm: properties.pricePerSqm,
      title: properties.title,
      firstSeen: properties.firstSeen,
      buildingType: propertyAnalysis.buildingType,
      locationCity: propertyAnalysis.locationCity,
      pricePerSqmAnalysis: propertyAnalysis.pricePerSqm,
    })
    .from(properties)
    .leftJoin(propertyAnalysis, eq(properties.id, propertyAnalysis.propertyId))
    .where(eq(properties.isActive, 1));

  const history = await db
    .select({ propertyId: priceHistory.propertyId, price: priceHistory.price, recordedAt: priceHistory.recordedAt })
    .from(priceHistory);

  // Sestavení vzorků per segment: pricePerSqm z analýzy, jinak price/area
  const samplesBySegment: Record<SegmentKey, number[]> = { byty: [], byty_panel: [], byty_cihla: [], domy: [] };
  for (const p of props) {
    if (!p.price || p.price <= 0) continue;
    const area = p.area ?? null;
    let perSqm = p.pricePerSqmAnalysis ?? p.pricePerSqm ?? null;
    if (perSqm == null && area && area > 0) perSqm = Math.round(p.price / area);
    if (perSqm == null || perSqm < 10000 || perSqm > 300000) continue;
    const seg = detectSegment(p.buildingType, p.title);
    samplesBySegment[seg].push(perSqm);
  }

  // Odlehlé hodnoty odstraníme per segment
  for (const key of Object.keys(samplesBySegment) as SegmentKey[]) {
    samplesBySegment[key] = removeOutliers(samplesBySegment[key]);
  }

  // Sestavení index points z priceHistory: medián ceny/m² v daném měsíci (jen záznamy se známou plochou)
  const historySamples = props
    .map((p) => ({
      propertyId: p.id,
      area: p.area ?? null,
      pricePerSqm: p.pricePerSqmAnalysis ?? p.pricePerSqm ?? (p.area ? Math.round(p.price / p.area) : null),
    }))
    .filter((x) => x.pricePerSqm != null && x.pricePerSqm > 10000 && x.pricePerSqm < 300000);

  const monthly: Record<string, number[]> = {};
  for (const h of history) {
    const rec = historySamples.find((s) => s.propertyId === h.propertyId);
    if (!rec || !rec.pricePerSqm) continue;
    const area = rec.area ?? null;
    const perSqm = area && area > 0 ? Math.round(h.price / area) : rec.pricePerSqm;
    if (perSqm < 10000 || perSqm > 300000) continue;
    const month = new Date(Number(h.recordedAt)).toISOString().slice(0, 7);
    if (!monthly[month]) monthly[month] = [];
    monthly[month].push(perSqm);
  }

  // Aktuální měsíc doplníme z aktivních inzerátů
  const nowMonth = new Date().toISOString().slice(0, 7);
  const currentAll = [...(monthly[nowMonth] ?? []), ...samplesBySegment.byty];
  monthly[nowMonth] = removeOutliers(currentAll);

  const points: IndexPoint[] = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, values]) => values.length >= 3)
    .map(([period, values]) => ({ period, value: median(values) }));

  if (points.length === 0) {
    // Bez historie: jen aktuální medián jako jediný bod (base 100)
    const allValues = removeOutliers([...samplesBySegment.byty, ...samplesBySegment.byty_panel, ...samplesBySegment.byty_cihla]);
    return {
      segments: buildSegments(samplesBySegment, 0),
      marketTrend: null,
      points: allValues.length > 0 ? [{ period: nowMonth, value: 100 }] : [],
    };
  }

  // Base 100 = medián celého trhu napříč všemi body (robustní, ne z jediného vzorku)
  const base = median(removeOutliers(points.map((p) => p.value)));
  const indexedPoints: IndexPoint[] = base > 0
    ? points.map((p) => ({ period: p.period, value: Math.round((p.value / base) * 100) }))
    : points;

  // Segment indexy: aktuální medián / base
  const segments = buildSegments(samplesBySegment, base);

  // Meziroční trend (poslední vs. bod ~12 měsíců dřív)
  let marketTrend: number | null = null;
  if (indexedPoints.length >= 2) {
    const last = indexedPoints[indexedPoints.length - 1];
    const yLast = parseInt(last.period.slice(0, 4));
    const mLast = parseInt(last.period.slice(5, 7));
    const yearAgo = indexedPoints.filter((p) => {
      const y = parseInt(p.period.slice(0, 4));
      const m = parseInt(p.period.slice(5, 7));
      return y === yLast - 1 && m === mLast;
    })[0];
    if (yearAgo && yearAgo.value > 0) {
      marketTrend = Math.round(((last.value - yearAgo.value) / yearAgo.value) * 1000) / 10;
    }
  }

  return { segments, marketTrend, points: indexedPoints };
}

function buildSegments(samplesBySegment: Record<SegmentKey, number[]>, base: number): SegmentIndex[] {
  return SEGMENT_DEFS.map((def) => {
    const samples = removeOutliers(samplesBySegment[def.key]);
    const current = median(samples);
    return {
      key: def.key,
      label: def.label,
      current,
      indexValue: base > 0 ? Math.round((current / base) * 100) : 100,
      sampleSize: samples.length,
      changePct: null,
    };
  });
}

// ---------- Cache (memory 15 min + market_cache 24 h) ----------

const MEM_TTL_MS = 15 * 60 * 1000;
const DB_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_SEGMENT = "price_index_cr";

let memCache: { data: PriceIndexResult; fetchedAt: number } | null = null;

/** Načte cache z market_cache (best-effort). */
async function readDbCache(): Promise<PriceIndexResult | null> {
  try {
    const row = await db
      .select({ payload: marketCache.payload, fetchedAt: marketCache.fetchedAt })
      .from(marketCache)
      .where(and(eq(marketCache.city, "cr"), eq(marketCache.segment, CACHE_SEGMENT)))
      .orderBy(desc(marketCache.fetchedAt))
      .limit(1)
      .then((r) => r[0]);
    if (!row || !row.payload) return null;
    if (Date.now() - Number(row.fetchedAt) > DB_TTL_MS) return null;
    const d = JSON.parse(row.payload) as PriceIndexResult;
    if (!d || !Array.isArray(d.segments)) return null;
    return d;
  } catch {
    return null;
  }
}

/** Uloží výsledek do market_cache (best-effort). */
async function persistDbCache(data: PriceIndexResult): Promise<void> {
  try {
    await db
      .insert(marketCache)
      .values({
        city: "cr",
        segment: CACHE_SEGMENT,
        low: 0,
        high: 0,
        median: 0,
        sampleSize: data.segments.reduce((s, x) => s + x.sampleSize, 0),
        source: "price_index",
        fetchedAt: Date.now(),
        payload: JSON.stringify(data),
      })
      .onConflictDoUpdate({
        target: [marketCache.city, marketCache.segment],
        set: { sampleSize: 0, source: "price_index", fetchedAt: Date.now(), payload: JSON.stringify(data) },
      });
  } catch {
    // cache je best-effort
  }
}

/**
 * Cenový index s cache (memory 15 min → DB 24 h → výpočet). Výsledek se mění jen
 * s přílivem nových inzerátů, proto je dlouhý TTL bez dopadu na UX a ušetří
 * dva full scany (properties + price_history) při každém načtení Trhu.
 */
export async function getPriceIndex(): Promise<PriceIndexResult> {
  if (memCache && Date.now() - memCache.fetchedAt < MEM_TTL_MS) {
    return memCache.data;
  }
  const cached = await readDbCache();
  if (cached) {
    memCache = { data: cached, fetchedAt: Date.now() };
    return cached;
  }
  const data = await computePriceIndex();
  memCache = { data, fetchedAt: Date.now() };
  await persistDbCache(data);
  return data;
}
