/**
 * Radar — zápis časových řad do radar_series (idempotentní upsert).
 */

import { db } from "@/db";
import { radarSeries } from "@/db/schema";
import { sql } from "drizzle-orm";
import { regionTypeOf } from "./radar-shared";

/** Jeden bod řady: [period "YYYY-MM", value]. */
export type SeriesPoint = [string, number];

/** Upsert jedné indikátorové řady (batch, onConflictDoUpdate). */
export async function upsertRadarSeries(
  indicator: string,
  regionKey: string,
  points: SeriesPoint[],
  meta?: string
): Promise<number> {
  if (points.length === 0) return 0;
  const now = Date.now();
  const regionType = regionTypeOf(regionKey);
  // dedupe period (poslední výskyt vyhrává) — batch s duplicitním PK selže
  const unique = new Map<string, number>();
  for (const [period, value] of points) unique.set(period, value);
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