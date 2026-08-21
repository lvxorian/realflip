/**
 * Radar — zápis časových řad do radar_series (idempotentní upsert).
 */

import { db } from "@/db";
import { radarSeries } from "@/db/schema";
import { sql } from "drizzle-orm";
import { regionTypeOf } from "./radar-shared";

/** Jeden bod řady: [period "YYYY-MM", value]. */
export type SeriesPoint = [string, number];

/**
 * Nejdéle uchovávané okno zápisu — 60 měsíců (= max. rozsah "5y" v UI radaru).
 * Starší periody se znovu NEzapisují (zůstávají v tabulce z předchozích běhů),
 * čímž se dramaticky snižuje DB egress — řady ČSÚ/ČNB se mění jen v recentu.
 */
const WRITE_WINDOW_MONTHS = 60;

/** Cutoff perioda (YYYY-MM) — body starší než tohle se při upsertu přeskočí. */
export function radarWriteCutoff(now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - (WRITE_WINDOW_MONTHS - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Vyfiltruje body na poslední okno zápisu (delta-zápis). Čistá funkce — testovatelná.
 */
export function filterToWriteWindow(points: SeriesPoint[], now = new Date()): SeriesPoint[] {
  const cutoff = radarWriteCutoff(now);
  return points.filter(([period]) => period >= cutoff);
}

/** Upsert jedné indikátorové řady (batch, onConflictDoUpdate) — jen recentní okno. */
export async function upsertRadarSeries(
  indicator: string,
  regionKey: string,
  points: SeriesPoint[],
  meta?: string
): Promise<number> {
  const recent = filterToWriteWindow(points);
  if (recent.length === 0) return 0;
  const now = Date.now();
  const regionType = regionTypeOf(regionKey);
  // dedupe period (poslední výskyt vyhrává) — batch s duplicitním PK selže
  const unique = new Map<string, number>();
  for (const [period, value] of recent) unique.set(period, value);
  const values = [...unique.entries()].map(([period, value]) => ({
    indicator,
    regionKey,
    regionType,
    period,
    value: Math.round(value * 1000) / 1000,
    meta: meta ?? null,
    fetchedAt: now,
  }));
  await db
    .insert(radarSeries)
    .values(values)
    .onConflictDoUpdate({
      target: [radarSeries.indicator, radarSeries.regionKey, radarSeries.period],
      set: { value: sql`excluded.value`, meta: sql`excluded.meta`, fetchedAt: sql`excluded.fetched_at` },
    });
  return values.length;
}