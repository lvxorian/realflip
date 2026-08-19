/**
 * Radar — snapshoty: čisté transformace časových řad na podoby pro grafy.
 *  - yieldGap: hypoteční sazba − repo sazba (Graf B)
 *  - cpiVsRealWages: CPI vs reálné mzdy ve stejných periodách (Graf C)
 *  - supplyVsPopulation: roční součet zahájených bytů vs přírůstek obyvatel (Graf F)
 *  - annualizeFlats: měsíční zahájené byty → roční součty
 *  - lastValue: poslední hodnota řady (KPI)
 */

import { dateToPeriod, rangeMonths } from "./radar-shared";
import type { SeriesPoint } from "./radar-store";

/** První perioda (YYYY-MM) zahrnutá v rozsahu (lexikografické porovnání funguje). */
function cutoffPeriod(range: string): string {
  const d = new Date();
  d.setMonth(d.getMonth() - (rangeMonths(range) - 1));
  return dateToPeriod(d);
}

export interface YieldGapPoint {
  period: string;
  mortgage: number;
  repo: number;
  gap: number;
}

/** Sjednotí hypoteční a repo sazbu na společné periody (Graf B). */
export function yieldGap(
  mortgage: SeriesPoint[],
  repo: SeriesPoint[],
  range: string = "3y"
): YieldGapPoint[] {
  const repoBy = new Map(repo);
  const cutoff = cutoffPeriod(range);
  const out: YieldGapPoint[] = [];
  for (const [period, rate] of mortgage) {
    const r = repoBy.get(period);
    if (r == null || period < cutoff) continue;
    out.push({
      period,
      mortgage: rate,
      repo: r,
      gap: Math.round((rate - r) * 1000) / 1000,
    });
  }
  return out;
}

export interface CpiWagePoint {
  period: string;
  cpi: number;
  realWage: number;
}

/** CPI a reálné mzdy v periodách, kde existují obě (Graf C, kvartální body). */
export function cpiVsRealWages(
  cpi: SeriesPoint[],
  realWages: SeriesPoint[],
  range: string = "3y"
): CpiWagePoint[] {
  const cpiBy = new Map(cpi);
  const cutoff = cutoffPeriod(range);
  const out: CpiWagePoint[] = [];
  for (const [period, real] of realWages) {
    const c = cpiBy.get(period);
    if (c == null || period < cutoff) continue;
    out.push({ period, cpi: c, realWage: real });
  }
  return out;
}

/** Měsíční řada → roční součty { year → součet }. */
export function annualizeFlats(flats: SeriesPoint[]): Map<number, number> {
  const byYear = new Map<number, number>();
  for (const [period, value] of flats) {
    const year = Number(period.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + value);
  }
  return byYear;
}

export interface SupplyPoint {
  regionKey: string;
  year: number;
  started: number;
  popGrowth: number;
}

/**
 * Zahájené byty (roční součet) vs meziroční přírůstek obyvatel (Graf F).
 * Pop growth perioda "YYYY-12" = růst během roku YYYY → párujeme se součtem
 * zahájených bytů téhož roku; používáme poslední rok, kde existují obě řady.
 */
export function supplyVsPopulation(
  flatsByRegion: Record<string, SeriesPoint[]>,
  popGrowthByRegion: Record<string, SeriesPoint[]>
): SupplyPoint[] {
  const out: SupplyPoint[] = [];
  for (const [regionKey, flats] of Object.entries(flatsByRegion)) {
    const annual = annualizeFlats(flats);
    const growthByYear = new Map<number, number>();
    for (const [period, value] of popGrowthByRegion[regionKey] ?? []) {
      if (!period.endsWith("-12")) continue;
      growthByYear.set(Number(period.slice(0, 4)), value);
    }
    const years = [...annual.keys()].filter((y) => growthByYear.has(y)).sort((a, b) => b - a);
    const year = years[0];
    if (year == null) continue;
    out.push({
      regionKey,
      year,
      started: annual.get(year)!,
      popGrowth: growthByYear.get(year)!,
    });
  }
  return out;
}

/** Poslední hodnota řady (KPI), null pro prázdnou řadu. */
export function lastValue(points: SeriesPoint[]): { period: string; value: number } | null {
  const last = points[points.length - 1];
  return last ? { period: last[0], value: last[1] } : null;
}
