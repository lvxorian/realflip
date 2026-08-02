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
 * NezamÄ›stnanost: niĹľĹˇĂ­ = lepĹˇĂ­. ÄŚR prĹŻmÄ›r ~4-5 %. 0 % â†’ 100, 12 %+ â†’ 0.
 */
export function scoreUnemployment(podilPct: number | null | undefined): number {
  if (podilPct == null) return 0;
  return clamp(Math.round(100 - podilPct * 8.33));
}

/**
 * Migrace (ÄŤistĂ© stÄ›hovĂˇnĂ­ na 1000 obyv.): kladnĂˇ = rostoucĂ­ poptĂˇvka.
 * 0 â†’ 50, +10â€° â†’ 100, -10â€° â†’ 0.
 */
export function scoreMigration(netPer1000: number | null | undefined): number {
  if (netPer1000 == null) return 0;
  return clamp(Math.round(50 + netPer1000 * 5));
}

/**
 * VÄ›kovĂˇ struktura: podĂ­l 65+ (lower = younger = better for rentals).
 * 15 % â†’ 90, 30 %+ â†’ 20.
 */
export function scoreAgeStructure(share65plusPct: number | null | undefined): number {
  if (share65plusPct == null) return 0;
  return clamp(Math.round(90 - (share65plusPct - 15) * 4.6));
}

/**
 * EkonomickĂˇ aktivita: poÄŤet firem na 1000 obyv. VĂ­ce firem = lepĹˇĂ­ pracovnĂ­ trh.
 * 0 â†’ 20, 50+ â†’ 100.
 */
export function scoreFirmsPerCapita(firms: number | null | undefined, population: number | null | undefined): number {
  if (firms == null || !population || population <= 0) return 0;
  const per1000 = (firms / population) * 1000;
  return clamp(Math.round(20 + per1000 * 1.6));
}

/**
 * Kriminalita: niĹľĹˇĂ­ index = lepĹˇĂ­. 200 â†’ 90, 600+ â†’ 0.
 */
export function scoreCrime(crimeIndex: number | null | undefined): number {
  if (crimeIndex == null) return 0;
  return clamp(Math.round(110 - crimeIndex * 0.18));
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
  // 11 kategoriĂ­, max teoreticky ~12 bodĹŻ/kategorii po oĹ™Ă­znutĂ­ â†’ normalizace
  return clamp(Math.round((total / 40) * 100));
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
}): LocalityFactors {
  const economic = weighted(scoreUnemployment(input.unemployment), scoreFirmsPerCapita(input.firms, input.population));
  const demographic = weighted(scoreMigration(input.migrationPer1000), scoreAgeStructure(input.share65plus));
  const walkability = input.walkability != null ? input.walkability : scoreWalkability(input.walkabilityCounts);
  const safety = scoreCrime(input.crimeIndex);

  const missing: string[] = [];
  if (input.unemployment == null) missing.push("nezamÄ›stnanost");
  if (input.migrationPer1000 == null) missing.push("migrace");
  if (input.share65plus == null) missing.push("vÄ›kovĂˇ struktura");
  if (input.firms == null) missing.push("firmy");
  if (input.crimeIndex == null) missing.push("kriminalita");
  if (input.walkability == null) missing.push("vybavenost");

  // VĂˇhy se pĹ™epoÄŤĂ­tajĂ­ jen z dostupnĂ˝ch dimenzĂ­ (chybÄ›jĂ­cĂ­ dimenze nesnĂ­ĹľĂ­ skĂłre).
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
    total,
    sourceData: {},
    weights: { ...LOCALITY_WEIGHTS },
    missing,
  };
}

/** Kolik bodĹŻ k investiÄŤnĂ­mu skĂłre pĹ™idĂˇ/odebere lokalitnĂ­ skĂłre (Â±8). */
export function localityScoreAdjustment(localityScore: number | null | undefined): number {
  if (localityScore == null) return 0;
  return Math.round((localityScore - 50) / 6.25);
}
