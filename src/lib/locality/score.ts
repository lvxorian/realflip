import { LOCALITY_WEIGHTS, LocalityFactors, PoiCounts } from "./types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

function weighted(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return b ?? 0;
  if (b == null) return a;
  return Math.round(a * 0.7 + b * 0.3);
}

/**
 * Nezamestnanost: nizsi = lepsi. CR prumer ~4-5 %. 0 % → 100, 12 %+ → 0.
 */
export function scoreUnemployment(podilPct: number | null | undefined): number {
  if (podilPct == null) return 0;
  return clamp(Math.round(100 - podilPct * 8.33));
}

/**
 * Migrace (ciste stehovani na 1000 obyv.): kladna = rostouci poptavka.
 * 0 → 50, +10‰ → 100, -10‰ → 0.
 */
export function scoreMigration(netPer1000: number | null | undefined): number {
  if (netPer1000 == null) return 0;
  return clamp(Math.round(50 + netPer1000 * 5));
}

/**
 * Vekova struktura: podil 65+ (lower = younger = better for rentals).
 * 15 % → 90, 30 %+ → 20.
 */
export function scoreAgeStructure(share65plusPct: number | null | undefined): number {
  if (share65plusPct == null) return 0;
  return clamp(Math.round(90 - (share65plusPct - 15) * 4.6));
}

/**
 * Ekonomicka aktivita: pocet firem na 1000 obyv. Vice firem = lepsi pracovni trh.
 * 0 → 20, 50+ → 100.
 */
export function scoreFirmsPerCapita(firms: number | null | undefined, population: number | null | undefined): number {
  if (firms == null || !population || population <= 0) return 0;
  const per1000 = (firms / population) * 1000;
  return clamp(Math.round(20 + per1000 * 1.6));
}

/**
 * Kriminalita: nizsi index (TČ per 100k obyv.) = lepsi.
 * ~1000 → 95, ~5000 → 45, 8000+ → 20.
 */
export function scoreCrime(crimeIndexPer100k: number | null | undefined): number {
  if (crimeIndexPer100k == null) return 0;
  return clamp(Math.round(95 - (crimeIndexPer100k - 1000) * 0.0125));
}

const POI_WEIGHTS: Record<keyof PoiCounts, number> = {
  skoly: 1,
  skolky: 1,
  mhd: 2,
  vlak: 2,
  obchody: 1,
  restaurace: 0.5,
  zdravotnictvi: 2,
  lekarny: 1,
  sport: 1,
  parky: 1.5,
  bankomaty: 0.5,
};

export function scoreWalkability(counts: Partial<PoiCounts> | null | undefined): number {
  if (!counts) return 0;
  let total = 0;
  for (const [key, w] of Object.entries(POI_WEIGHTS)) {
    const v = (counts as Record<string, number | undefined>)[key] ?? 0;
    total += Math.min(v, 5) * w;
  }
  return clamp(Math.round((total / 40) * 100));
}

/**
 * Hruby vyvojovy vynos (gross yield %): 3 % → 30, 8 %+ → 100.
 */
export function scoreRentalYield(grossYieldPct: number | null | undefined): number {
  if (grossYieldPct == null) return 0;
  return clamp(Math.round((grossYieldPct - 3) * 20));
}

/**
 * Dopravni dostupnost: transportScore (0-100) primo.
 */
export function scoreTransport(transport: number | null | undefined): number {
  if (transport == null) return 0;
  return clamp(Math.round(transport));
}

const TRANSPORT_NONE = 100000;

/**
 * Dopravni skore 0–100 pro konkretni vzdalenosti (m).
 * Metro: <300 m = 100, >2000 m = 0. Vlak: <500 m = 100, >5000 m = 0. Bus: <150 m = 100, >2000 m = 0.
 */
export function scoreTransportDistance(
  metro: number | null,
  train: number | null,
  bus: number | null
): number {
  const metroScore = metro != null && metro !== TRANSPORT_NONE ? Math.max(0, Math.min(100, Math.round(100 - metro / 20))) : 0;
  const trainScore = train != null && train !== TRANSPORT_NONE ? Math.max(0, Math.min(100, Math.round(100 - train / 50))) : 0;
  const busScore = bus != null && bus !== TRANSPORT_NONE ? Math.max(0, Math.min(100, Math.round(100 - bus / 20))) : 0;
  let weighted = 0;
  let weightTotal = 0;
  if (metro != null && metro !== TRANSPORT_NONE) { weighted += metroScore * 2; weightTotal += 2; }
  if (train != null && train !== TRANSPORT_NONE) { weighted += trainScore * 1.5; weightTotal += 1.5; }
  if (bus != null && bus !== TRANSPORT_NONE) { weighted += busScore; weightTotal += 1; }
  return weightTotal > 0 ? Math.round(weighted / weightTotal) : 0;
}

export function computeLocalityFactors(input: {
  unemployment?: number | null;
  migrationPer1000?: number | null;
  share65plus?: number | null;
  firms?: number | null;
  population?: number | null;
  crimeIndex?: number | null;
  walkability?: number | null;
  walkabilityCounts?: Partial<PoiCounts> | null;
  grossYieldPct?: number | null;
  transportScore?: number | null;
}): LocalityFactors {
  const economic = weighted(scoreUnemployment(input.unemployment), scoreFirmsPerCapita(input.firms, input.population));
  const demographic = weighted(scoreMigration(input.migrationPer1000), scoreAgeStructure(input.share65plus));
  const walkability = input.walkability != null ? input.walkability : scoreWalkability(input.walkabilityCounts);
  const safety = scoreCrime(input.crimeIndex);
  const rental = scoreRentalYield(input.grossYieldPct);
  const transport = scoreTransport(input.transportScore);

  const missing: string[] = [];
  if (input.unemployment == null) missing.push("nezaměstnanost");
  if (input.migrationPer1000 == null) missing.push("migrace");
  if (input.share65plus == null) missing.push("věková struktura");
  if (input.firms == null) missing.push("firmy");
  if (input.crimeIndex == null) missing.push("kriminalita");
  if (input.walkability == null) missing.push("vybavenost");

  // Lokalitni skore = vazeny prumer zakladnich 4 dimenzi (chybejici se prepocitaji)
  const dims: [number, number][] = [];
  if (input.unemployment != null || input.firms != null) dims.push([economic, LOCALITY_WEIGHTS.economic]);
  if (input.migrationPer1000 != null || input.share65plus != null) dims.push([demographic, LOCALITY_WEIGHTS.demographic]);
  if (input.walkability != null) dims.push([walkability, LOCALITY_WEIGHTS.walkability]);
  if (input.crimeIndex != null) dims.push([safety, LOCALITY_WEIGHTS.safety]);
  const totalWeight = dims.reduce((s, [, w]) => s + w, 0);
  const total =
    totalWeight > 0
      ? Math.round(dims.reduce((s, [v, w]) => s + v * w, 0) / totalWeight)
      : 0;

  return {
    economic: { score: economic, unemploymentPct: input.unemployment ?? null, firms: input.firms ?? null },
    demographic: { score: demographic, migrationNet: input.migrationPer1000 ?? null, population: input.population ?? null, share65plus: input.share65plus ?? null },
    walkability: { score: walkability, counts: input.walkabilityCounts ?? {} },
    safety: { score: safety, crimeIndex: input.crimeIndex ?? null },
    transport: { score: transport, premiumPct: null },
    rental: { score: rental, rentPerSqm: null, grossYieldPct: input.grossYieldPct ?? null },
    total,
    sourceData: {},
    weights: { ...LOCALITY_WEIGHTS },
    missing,
  };
}

/** Kolik bodu k investicnimu skore prida/odebere lokalitni skore (±8). */
export function localityScoreAdjustment(localityScore: number | null | undefined): number {
  if (localityScore == null) return 0;
  return Math.round((localityScore - 50) / 6.25);
}
