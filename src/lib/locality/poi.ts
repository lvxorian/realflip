import { PoiCounts } from "./types";
import { scoreWalkability } from "./score";
import { db } from "@/db";
import { rents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ts } from "@/lib/utils";

/**
 * POI / walkability z reálných dat sreality.cz API.
 * Search API vrací pro každý inzerát vzdálenosti k POI (metro, vlak, bus, škola,
 * obchod, restaurace, bankomat, zdravotnictví...). Agregujeme medián vzdáleností
 * pro dané město/okres a převedeme na walkability skóre.
 */

const BASE_API = "https://www.sreality.cz/api/v1/estates/search";
const RESULTS_PER_PAGE = 100;
const MAX_PAGES = 1;

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.sreality.cz/",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

interface SrealityPoiItem {
  poi_metro_distance?: number;
  poi_train_distance?: number;
  poi_bus_public_transport_distance?: number;
  poi_school_distance?: number;
  poi_kindergarten_distance?: number;
  poi_shop_distance?: number;
  poi_small_shop_distance?: number;
  poi_restaurant_distance?: number;
  poi_atm_distance?: number;
  poi_medic_distance?: number;
}

const NONE = 100000;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Vzdálenost (m) → skóre 0-100 (blíž = lépe). */
function distanceScore(d: number | undefined, noneValue: number, maxDistance: number): number | null {
  if (d == null || d >= NONE) return null;
  return Math.max(0, Math.min(100, Math.round(100 - (d / maxDistance) * 100)));
}

export interface PoiResult {
  counts: PoiCounts;
  walkability: number;
  sampleSize: number;
}

/** Získá POI vzdálenosti pro dané město (přes sreality search + okres filter). */
async function fetchSrealityPoi(cityKey: string, districtSeoName?: string): Promise<SrealityPoiItem[]> {
  const url = `${BASE_API}?category_main_cb=1&category_type_cb=1&limit=${RESULTS_PER_PAGE}&offset=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    if (res.status === 429 || res.status === 403) {
      await new Promise((r) => setTimeout(r, 20000));
      return fetchSrealityPoi(cityKey, districtSeoName);
    }
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  const data = await res.json();
  return (data?.results ?? []).filter(
    (it: any) =>
      it.locality?.city &&
      it.locality.city.toLowerCase() === cityKey.replace(/_/g, " ")
  );
}

export async function fetchPoi(_lat: number, _lng: number): Promise<PoiResult> {
  // POI per souřadnice není přes sreality API přímo — použijeme průměr města.
  // Tato funkce je volána s cityKey kontextem jinde (getLocalityForProperty).
  throw new Error("fetchPoi needs cityKey — use fetchPoiForCity");
}

/** POI walkability pro město z reálných sreality dat. */
export async function fetchPoiForCity(cityKey: string): Promise<PoiResult> {
  const items = await fetchSrealityPoi(cityKey);
  if (items.length < 3) {
    return { counts: emptyCounts(), walkability: 0, sampleSize: items.length };
  }

  const dist = (key: keyof SrealityPoiItem): number[] =>
    items.map((i) => i[key] ?? NONE).filter((d) => d < NONE);

  const metro = distanceScore(median(dist("poi_metro_distance")), 100000, 2000);
  const train = distanceScore(median(dist("poi_train_distance")), 100000, 5000);
  const bus = distanceScore(median(dist("poi_bus_public_transport_distance")), 100000, 2000);
  const school = distanceScore(median(dist("poi_school_distance")), 100000, 2000);
  const kindergarten = distanceScore(median(dist("poi_kindergarten_distance")), 100000, 2000);
  const shop = distanceScore(median(dist("poi_shop_distance")), 100000, 3000);
  const restaurant = distanceScore(median(dist("poi_restaurant_distance")), 100000, 3000);
  const atm = distanceScore(median(dist("poi_atm_distance")), 100000, 3000);
  const medic = distanceScore(median(dist("poi_medic_distance")), 100000, 5000);

  // Převedeme skóre zpět na "počty" pro kompatibilitu s PoiCounts (proxy: blízké POI = vysoké skóre)
  const counts: PoiCounts = {
    skoly: school != null && school > 60 ? 2 : school != null && school > 30 ? 1 : 0,
    skolky: kindergarten != null && kindergarten > 60 ? 2 : kindergarten != null && kindergarten > 30 ? 1 : 0,
    mhd: bus != null && bus > 60 ? 3 : bus != null && bus > 30 ? 2 : bus != null ? 1 : 0,
    vlak: train != null && train > 60 ? 2 : train != null && train > 30 ? 1 : 0,
    obchody: shop != null && shop > 60 ? 2 : shop != null && shop > 30 ? 1 : 0,
    restaurace: restaurant != null && restaurant > 60 ? 2 : restaurant != null && restaurant > 30 ? 1 : 0,
    zdravotnictvi: medic != null && medic > 60 ? 2 : medic != null && medic > 30 ? 1 : 0,
    lekarny: 0,
    sport: 0,
    parky: 0,
    bankomaty: atm != null && atm > 60 ? 2 : atm != null && atm > 30 ? 1 : 0,
  };

  return { counts, walkability: scoreWalkability(counts), sampleSize: items.length };
}

function emptyCounts(): PoiCounts {
  return {
    skoly: 0, skolky: 0, mhd: 0, vlak: 0, obchody: 0, restaurace: 0,
    zdravotnictvi: 0, lekarny: 0, sport: 0, parky: 0, bankomaty: 0,
  };
}

const POI_CACHE_SOURCE = "sreality-poi";

/** Cache POI walkability v rents tabulce (segment='poi'). */
export async function getPoiForCityCached(cityKey: string): Promise<{ walkability: number; counts: PoiCounts; sampleSize: number } | null> {
  const TTL_MS = 24 * 60 * 60 * 1000;
  const row = await db
    .select()
    .from(rents)
    .where(and(eq(rents.cityKey, cityKey), eq(rents.segment, "poi")))
    .limit(1)
    .then((r) => r[0]);
  if (row && Date.now() - Number(row.fetchedAt) < TTL_MS && row.walkability != null) {
    try {
      const counts = JSON.parse(row.countsJson ?? "{}") as PoiCounts;
      return { walkability: row.walkability ?? 0, counts, sampleSize: row.sampleSize };
    } catch {
      // fall through
    }
  }

  try {
    const result = await fetchPoiForCity(cityKey);
    if (result.sampleSize >= 3) {
      await db
        .insert(rents)
        .values({
          cityKey,
          segment: POI_CACHE_SOURCE,
          rentPerSqm: null,
          medianRent: null,
          sampleSize: result.sampleSize,
          fetchedAt: ts(),
        })
        .onConflictDoUpdate({
          target: [rents.cityKey, rents.segment],
          set: {
            walkability: result.walkability,
            countsJson: JSON.stringify(result.counts),
            sampleSize: result.sampleSize,
            fetchedAt: ts(),
          },
        });
      return { walkability: result.walkability, counts: result.counts, sampleSize: result.sampleSize };
    }
  } catch (e) {
    console.error("POI fetch failed:", e);
  }
  return null;
}
