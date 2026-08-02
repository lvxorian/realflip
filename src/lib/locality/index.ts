import { db } from "@/db";
import { localityMetrics, poiMetrics, propertyAnalysis, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ts } from "@/lib/utils";
import { fetchUnemployment, fetchMigration } from "./czso";
import { crimeIndexForCity } from "./crime";
import { fetchPoi } from "./poi";
import { computeLocalityFactors, localityScoreAdjustment, scoreMigration, scoreWalkability } from "./score";
import { LocalityFactors, PoiCounts } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredMetric {
  jsonData: string;
  fetchedAt: number;
}

async function getMetric(cityKey: string, source: string, period: string): Promise<StoredMetric | null> {
  const row = await db
    .select({ jsonData: localityMetrics.jsonData, fetchedAt: localityMetrics.fetchedAt })
    .from(localityMetrics)
    .where(
      and(
        eq(localityMetrics.cityKey, cityKey),
        eq(localityMetrics.source, source),
        eq(localityMetrics.period, period)
      )
    )
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  return { jsonData: row.jsonData, fetchedAt: Number(row.fetchedAt) };
}

async function upsertMetric(cityKey: string, source: string, period: string, data: unknown): Promise<void> {
  const now = ts();
  const jsonData = JSON.stringify(data);
  await db
    .insert(localityMetrics)
    .values({ cityKey, source, period, jsonData, fetchedAt: now })
    .onConflictDoUpdate({
      target: [localityMetrics.cityKey, localityMetrics.source, localityMetrics.period],
      set: { jsonData, fetchedAt: now },
    });
}

async function getPoiMetric(cityKey: string, district: string): Promise<StoredMetric | null> {
  const row = await db
    .select({ jsonData: poiMetrics.countsJson, fetchedAt: poiMetrics.fetchedAt, walkability: poiMetrics.walkability })
    .from(poiMetrics)
    .where(and(eq(poiMetrics.cityKey, cityKey), eq(poiMetrics.district, district)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  return { jsonData: row.jsonData, fetchedAt: Number(row.fetchedAt) };
}

async function upsertPoiMetric(cityKey: string, district: string, counts: Partial<PoiCounts>, walkability: number): Promise<void> {
  const now = ts();
  await db
    .insert(poiMetrics)
    .values({ cityKey, district, countsJson: JSON.stringify(counts), walkability, fetchedAt: now })
    .onConflictDoUpdate({
      target: [poiMetrics.cityKey, poiMetrics.district],
      set: { countsJson: JSON.stringify(counts), walkability, fetchedAt: now },
    });
}

export interface LocalitySummary {
  cityKey: string;
  district: string;
  score: number;
  factors: LocalityFactors;
  cached: boolean;
  fetchedAt?: number;
}

/**
 * Vypočítá lokalitní faktory pro nemovitost. Používá TTL cache (24 h) pro POI i ČSÚ data.
 * Při výpadku zdroje vrátí faktory z dostupných dat (chybějící dimenze se vynechají).
 */
export async function getLocalityForProperty(input: {
  cityKey: string;
  district: string | null;
  lat: number | null;
  lng: number | null;
}): Promise<LocalitySummary | null> {
  const { cityKey, district, lat, lng } = input;
  if (!cityKey || cityKey === "Neznámá" || cityKey === "unknown") return null;

  const now = Date.now();

  // POI — cache per cityKey+district (nebo per cityKey, pokud nemáme lat/lng)
  const poiKey = district && district.length > 0 ? district : "__city__";
  let poiCounts: Partial<PoiCounts> | null = null;
  let walkability: number | null = null;
  let poiFetchedAt: number | undefined;

  const cachedPoi = await getPoiMetric(cityKey, poiKey);
  if (cachedPoi && now - cachedPoi.fetchedAt < TTL_MS) {
    try {
      poiCounts = JSON.parse(cachedPoi.jsonData);
      walkability = poiCounts ? scoreWalkability(poiCounts) : null;
    } catch {
      poiCounts = null;
    }
    poiFetchedAt = cachedPoi.fetchedAt;
  } else if (lat != null && lng != null) {
    try {
      const poi = await fetchPoi(lat, lng);
      poiCounts = poi.counts;
      walkability = poi.walkability;
      await upsertPoiMetric(cityKey, poiKey, poi.counts, poi.walkability);
    } catch {
      poiCounts = null;
    }
  }

  // ČSÚ nezaměstnanost — město úroveň, cache 24 h
  let unemployment: number | null = null;
  let unemploymentPeriod = "";
  const cachedUnemp = await getMetric(cityKey, "czso-unemployment", "latest");
  if (cachedUnemp && now - cachedUnemp.fetchedAt < TTL_MS) {
    try {
      const d = JSON.parse(cachedUnemp.jsonData) as { value: number; period: string };
      unemployment = d.value;
      unemploymentPeriod = d.period;
    } catch {
      unemployment = null;
    }
  } else {
    try {
      const { byCity, period } = await fetchUnemployment();
      unemployment = byCity[cityKey] ?? null;
      unemploymentPeriod = period;
      if (unemployment != null) await upsertMetric(cityKey, "czso-unemployment", "latest", { value: unemployment, period });
    } catch {
      unemployment = null;
    }
  }

  // ČSÚ migrace — město úroveň
  let migrationNet: number | null = null;
  let population: number | null = null;
  let migrationPeriod = "";
  const cachedMig = await getMetric(cityKey, "czso-migration", "latest");
  if (cachedMig && now - cachedMig.fetchedAt < TTL_MS) {
    try {
      const d = JSON.parse(cachedMig.jsonData) as { migraceNet: number; obyvatel: number; period: string };
      migrationNet = d.migraceNet;
      population = d.obyvatel;
      migrationPeriod = d.period;
    } catch {
      migrationNet = null;
    }
  } else {
    try {
      const { byCity, period } = await fetchMigration();
      const d = byCity[cityKey];
      if (d) {
        migrationNet = d.migraceNet;
        population = d.obyvatel;
        migrationPeriod = period;
        await upsertMetric(cityKey, "czso-migration", "latest", { migraceNet: d.migraceNet, obyvatel: d.obyvatel, period });
      }
    } catch {
      migrationNet = null;
    }
  }

  // Kriminalita — statická mapa
  const crimeIndex = crimeIndexForCity(cityKey);

  // Sestavení faktorů
  const migrationPer1000 =
    migrationNet != null && population != null && population > 0 ? (migrationNet / population) * 1000 : null;

  const factors = computeLocalityFactors({
    unemployment,
    migrationPer1000,
    firms: null,
    population,
    crimeIndex,
    walkability,
  });

  const fetchedAt = poiFetchedAt ?? (cachedUnemp?.fetchedAt ?? cachedMig?.fetchedAt);

  return {
    cityKey,
    district: district ?? "",
    score: factors.total,
    factors,
    cached: !!cachedPoi || !!cachedUnemp || !!cachedMig,
    fetchedAt,
  };
}

export { localityScoreAdjustment, scoreMigration };

/** Obnoví lokální data pro daná města (použito z tlačítka / skriptu). */
export async function refreshLocalityCities(cityKeys: string[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  const uniq = [...new Set(cityKeys.filter((c) => c && c !== "Neznámá" && c !== "unknown"))];
  try {
    const unemp = await fetchUnemployment();
    for (const key of uniq) {
      if (unemp.byCity[key] != null) {
        await upsertMetric(key, "czso-unemployment", "latest", { value: unemp.byCity[key], period: unemp.period });
        ok++;
      }
    }
  } catch {
    failed++;
  }
  try {
    const mig = await fetchMigration();
    for (const key of uniq) {
      const d = mig.byCity[key];
      if (d) {
        await upsertMetric(key, "czso-migration", "latest", { migraceNet: d.migraceNet, obyvatel: d.obyvatel, period: mig.period });
        ok++;
      }
    }
  } catch {
    failed++;
  }
  return { ok, failed };
}

/**
 * Vypočítá lokalitní faktory pro nemovitost a uloží je do propertyAnalysis.
 * Upraví investmentScore o localityScoreAdjustment (±8).
 * Vrací { localityScore, factors } nebo null, pokud lokalita není dostupná.
 */
export async function analyzeLocalityAndPersist(input: {
  propertyId: string;
  cityKey: string;
  district: string | null;
  lat: number | null;
  lng: number | null;
  currentInvestmentScore: number;
}): Promise<{ localityScore: number; factors: LocalityFactors; adjustedScore: number } | null> {
  const { propertyId, currentInvestmentScore } = input;
  const summary = await getLocalityForProperty(input);
  if (!summary) return null;

  const adjustment = localityScoreAdjustment(summary.score);
  const adjustedScore = Math.min(100, Math.max(0, currentInvestmentScore + adjustment));

  await db
    .update(propertyAnalysis)
    .set({
      localityScore: summary.score,
      localityFactorsJson: JSON.stringify(summary.factors),
      investmentScore: adjustedScore,
      updatedAt: ts(),
    })
    .where(eq(propertyAnalysis.propertyId, propertyId));

  return { localityScore: summary.score, factors: summary.factors, adjustedScore };
}

/** Seznam cityKeyů, které mají smysl načítat (z aktivních nemovitostí). */
export async function distinctActiveCityKeys(): Promise<string[]> {
  const { isNotNull } = await import("drizzle-orm");
  const rows = await db
    .select({ city: propertyAnalysis.locationCity })
    .from(propertyAnalysis)
    .innerJoin(properties, eq(propertyAnalysis.propertyId, properties.id))
    .where(and(eq(properties.isActive, 1), isNotNull(propertyAnalysis.locationCity)));
  return [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c))];
}
