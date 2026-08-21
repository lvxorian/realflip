/**
 * Radar — čtení dat pro dashboard: série z radar_series (makro), vlastní
 * inzeráty (nové/stažené), cenová mapa (reuse price-map.ts s vlastní cache),
 * zahájené byty vs obyvatelstvo, heatmapa měst (cena/m², price-to-rent, 65+).
 */

import { db } from "@/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { localityMetrics, properties, propertyAnalysis, rents, radarSeries } from "@/db/schema";
import { fetchPriceMap } from "@/lib/valuation/price-map";
import { KRAJ_KEYS, rangeMonths } from "./radar-shared";
import type { SeriesPoint } from "./radar-store";
import { cpiVsRealWages, lastValue, supplyVsPopulation, yieldGap } from "./snapshots";

const IND = {
  repo: "repo_rate",
  mortgage: "cba_mortgage_rate",
  cpi: "cpi_yoy",
  realWage: "real_wage_yoy",
  started: "started_flats",
  pop: "pop_growth",
} as const;

/** Perioda (YYYY-MM) před `months` měsíci — cutoff pro načítání řad. */
function cutoff(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - (months - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Načte řadu z radar_series (posledních `months` měsíců, seřazeně). */
export async function readSeries(
  indicator: string,
  regionKey: string,
  months: number
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({ period: radarSeries.period, value: radarSeries.value })
    .from(radarSeries)
    .where(
      and(
        eq(radarSeries.indicator, indicator),
        eq(radarSeries.regionKey, regionKey),
        gte(radarSeries.period, cutoff(months))
      )
    )
    .orderBy(radarSeries.period);
  return rows.map((r) => [r.period, r.value] as SeriesPoint);
}

/** Načte řadu pro více regionů jedním dotazem (IN) → mapa regionKey → body. */
export async function readSeriesMany(
  indicator: string,
  regionKeys: string[],
  months: number
): Promise<Record<string, SeriesPoint[]>> {
  if (regionKeys.length === 0) return {};
  const rows = await db
    .select({ regionKey: radarSeries.regionKey, period: radarSeries.period, value: radarSeries.value })
    .from(radarSeries)
    .where(
      and(
        eq(radarSeries.indicator, indicator),
        inArray(radarSeries.regionKey, regionKeys),
        gte(radarSeries.period, cutoff(months))
      )
    )
    .orderBy(radarSeries.period);
  const out: Record<string, SeriesPoint[]> = {};
  for (const r of rows) {
    if (!out[r.regionKey]) out[r.regionKey] = [];
    out[r.regionKey].push([r.period, r.value] as SeriesPoint);
  }
  return out;
}

// ---------- Makro (Graf A/B/C + KPI) ----------

export interface KpiTile {
  key: string;
  label: string;
  value: number;
  period: string;
  unit: string;
}

export interface MacroData {
  rates: { period: string; mortgage: number; repo: number }[];
  gaps: { period: string; gap: number }[];
  cpiReal: { period: string; cpi: number; realWage: number }[];
  kpis: KpiTile[];
}

/** Makro data pro vybraný rozsah (vždy region "cr" — národní sazby). */
export async function getMacroData(range: string = "1y"): Promise<MacroData> {
  const months = rangeMonths(range);
  const [repo, mortgage, cpi, realWage] = await Promise.all([
    readSeries(IND.repo, "cr", months),
    readSeries(IND.mortgage, "cr", months),
    readSeries(IND.cpi, "cr", months),
    readSeries(IND.realWage, "cr", months),
  ]);

  const gaps = yieldGap(mortgage, repo, range);
  const cpiReal = cpiVsRealWages(cpi, realWage, range);

  const r = lastValue(repo);
  const m = lastValue(mortgage);
  const c = lastValue(cpi);
  const rw = lastValue(realWage);
  const kpis: KpiTile[] = [];
  if (r) kpis.push({ key: "repo", label: "Repo sazba ČNB", value: r.value, period: r.period, unit: "%" });
  if (m) kpis.push({ key: "mortgage", label: "Hypoteční sazba", value: m.value, period: m.period, unit: "%" });
  if (c) kpis.push({ key: "cpi", label: "Inflace (CPI)", value: c.value, period: c.period, unit: "%" });
  if (rw) kpis.push({ key: "realWage", label: "Reálné mzdy (y/y)", value: rw.value, period: rw.period, unit: "%" });

  return {
    rates: gaps.map((g) => ({ period: g.period, mortgage: g.mortgage, repo: g.repo })),
    gaps: gaps.map((g) => ({ period: g.period, gap: g.gap })),
    cpiReal,
    kpis,
  };
}

// ---------- Cenová mapa (Graf D) ----------

export interface PriceMapRegionRow {
  regionKey: string;
  name: string;
  pricePerSqm: number;
  transactions: number;
}

/** Regionální ceny z cenové mapy (vlastní 7d cache uvnitř price-map.ts). */
export async function getPriceMapRegions(): Promise<PriceMapRegionRow[]> {
  const data = await fetchPriceMap();
  if (!data) return [];
  return data.regions
    .filter((r) => KRAJ_KEYS.includes(r.regionKey))
    .map((r) => ({
      regionKey: r.regionKey,
      name: r.name,
      pricePerSqm: Math.round(r.avgPricePerSqm),
      transactions: r.numTransactions,
    }))
    .sort((a, b) => b.pricePerSqm - a.pricePerSqm);
}

// ---------- Vlastní inzeráty (Graf E) ----------

export interface ListingFlowPoint {
  period: string;
  nove: number;
  stazene: number;
}

interface ListingSnapshot {
  firstSeen: number | null;
  removedAt: number | null;
  isActive: number | null;
  price: number | null;
  area: number | null;
  city: string | null;
}

/**
 * Jeden scan vlastních inzerátů (properties LEFT JOIN propertyAnalysis) sdílený
 * mezi `getListingFlow` a `getCityHeatmap` — dřív se tabulka projížděla 2×.
 */
async function loadListingSnapshot(): Promise<ListingSnapshot[]> {
  const rows = await db
    .select({
      firstSeen: properties.firstSeen,
      removedAt: properties.removedAt,
      isActive: properties.isActive,
      price: properties.price,
      area: properties.area,
      city: propertyAnalysis.locationCity,
    })
    .from(properties)
    .leftJoin(propertyAnalysis, eq(properties.id, propertyAnalysis.propertyId));
  return rows as ListingSnapshot[];
}

/** Nové vs stažené inzeráty z vlastní databáze (posledních `months` měsíců). */
export async function getListingFlow(months: number = 12): Promise<ListingFlowPoint[]> {
  const rows = await loadListingSnapshot();

  const fromTs = Date.now() - months * 31 * 86400000;
  const nove = new Map<string, number>();
  const stazene = new Map<string, number>();
  for (const p of rows) {
    const t = Number(p.firstSeen);
    if (t >= fromTs) {
      const d = new Date(t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      nove.set(key, (nove.get(key) ?? 0) + 1);
    }
    if (!p.isActive && p.removedAt) {
      const t2 = Number(p.removedAt);
      if (t2 >= fromTs) {
        const d = new Date(t2);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        stazene.set(key, (stazene.get(key) ?? 0) + 1);
      }
    }
  }
  const periods = [...new Set([...nove.keys(), ...stazene.keys()])].sort();
  return periods.map((period) => ({ period, nove: nove.get(period) ?? 0, stazene: stazene.get(period) ?? 0 }));
}

// ---------- Nabídka vs obyvatelstvo (Graf F) ----------

export interface SupplyRegionRow {
  regionKey: string;
  year: number;
  started: number;
  popGrowth: number;
}

/** Zahájené byty vs přírůstek obyvatel pro ČR a všechny kraje. */
export async function getSupplyVsPopulation(): Promise<SupplyRegionRow[]> {
  const months = 24 * 13; // stačí pokrýt všechny roky
  const regionKeys = ["cr", ...KRAJ_KEYS];
  const [flats, pop] = await Promise.all([
    readSeriesMany(IND.started, regionKeys, months),
    readSeriesMany(IND.pop, regionKeys, months),
  ]);
  return supplyVsPopulation(flats, pop).sort((a, b) => b.started - a.started);
}

// ---------- Heatmapa měst ----------

export interface CityHeatmapRow {
  cityKey: string;
  name: string;
  pricePerSqm: number;
  listings: number;
  rentPerSqm: number | null;
  priceToRent: number | null;
  share65plus: number | null;
}

/**
 * Města z vlastních inzerátů: Ø cena/m² (aktivní nabídky), nájem (rents),
 * price-to-rent a podíl 65+ (czso-sldb). Seřazeno podle počtu inzerátů.
 */
export async function getCityHeatmap(limit: number = 25): Promise<CityHeatmapRow[]> {
  const props = await loadListingSnapshot();

  const byCity = new Map<string, { priceSqm: number[]; count: number }>();
  for (const p of props) {
    if (!p.isActive) continue;
    const city = p.city ?? "Neznamo";
    if (!byCity.has(city)) byCity.set(city, { priceSqm: [], count: 0 });
    const row = byCity.get(city)!;
    row.count++;
    if (p.area && p.area > 0 && p.price && p.price > 0) row.priceSqm.push(p.price / p.area);
  }

  const cityKeys = [...byCity.keys()];
  const [rentRows, sldbRows] = await Promise.all([
    cityKeys.length > 0
      ? db
          .select({ cityKey: rents.cityKey, rentPerSqm: rents.rentPerSqm })
          .from(rents)
          .where(eq(rents.segment, "any"))
      : Promise.resolve([]),
    cityKeys.length > 0
      ? db
          .select({ cityKey: localityMetrics.cityKey, jsonData: localityMetrics.jsonData })
          .from(localityMetrics)
          .where(and(eq(localityMetrics.source, "czso-sldb"), eq(localityMetrics.period, "latest")))
      : Promise.resolve([]),
  ]);

  const rentByCity = new Map(rentRows.map((r) => [r.cityKey, r.rentPerSqm]));
  const sldbByCity = new Map<string, number>();
  for (const row of sldbRows) {
    try {
      const d = JSON.parse(row.jsonData) as { share65plus?: number };
      if (typeof d.share65plus === "number") sldbByCity.set(row.cityKey, d.share65plus);
    } catch {
      // ignorovat
    }
  }

  const rows: CityHeatmapRow[] = [];
  for (const [cityKey, agg] of byCity) {
    const pricePerSqm = agg.priceSqm.length > 0
      ? Math.round(agg.priceSqm.reduce((a, b) => a + b, 0) / agg.priceSqm.length)
      : 0;
    if (pricePerSqm <= 0) continue;
    const rentPerSqm = rentByCity.get(cityKey) ?? null;
    const name = cityKey.replace(/_/g, " ");
    rows.push({
      cityKey,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      pricePerSqm,
      listings: agg.count,
      rentPerSqm: rentPerSqm != null ? Math.round(rentPerSqm) : null,
      priceToRent:
        rentPerSqm != null && rentPerSqm > 0 ? Math.round((pricePerSqm / (rentPerSqm * 12)) * 10) / 10 : null,
      share65plus: sldbByCity.get(cityKey) ?? null,
    });
  }
  return rows.sort((a, b) => b.listings - a.listings).slice(0, limit);
}

// ---------- Kompletní data pro stránku ----------

export interface RadarData {
  macro: MacroData;
  priceMap: PriceMapRegionRow[];
  listingFlow: ListingFlowPoint[];
  supply: SupplyRegionRow[];
  cities: CityHeatmapRow[];
}

// Paměťová cache stránky (15 min) — data radaru se mění jen s denním crawlenním,
// cache ušetří 4 full scany + 30 série-dotazů při každém načtení/přepnutí rozsahu.
const RADAR_MEM_TTL_MS = 15 * 60 * 1000;
const radarMemCache = new Map<string, { data: RadarData; fetchedAt: number }>();

/** Vše pro /radar najednou (s krátkou paměťovou cache per range). */
export async function getRadarData(range: string = "1y"): Promise<RadarData> {
  const hit = radarMemCache.get(range);
  if (hit && Date.now() - hit.fetchedAt < RADAR_MEM_TTL_MS) {
    return hit.data;
  }
  const [macro, priceMap, listingFlow, supply, cities] = await Promise.all([
    getMacroData(range),
    getPriceMapRegions(),
    getListingFlow(12),
    getSupplyVsPopulation(),
    getCityHeatmap(25),
  ]);
  const data = { macro, priceMap, listingFlow, supply, cities };
  radarMemCache.set(range, { data, fetchedAt: Date.now() });
  return data;
}
