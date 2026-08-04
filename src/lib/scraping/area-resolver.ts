import type { RawListing } from "./types";

/**
 * Pravidla pro určení skutečné obytné (podlahové) plochy z inzerátu:
 * - oba údaje + rozdíl > 15 %  → obytná = MENŠÍ, rozdíl se bere jako odhad
 *   plochy příslušenství (terasa/balkon/lodžie/sklep), větší údaj v české
 *   inzerci téměř vždy chybně zahrnuje terasu/balkon/sklep.
 * - oba údaje + rozdíl ≤ 15 %    → obytná = podlahová plocha (rozdíl je jen
 *   tloušťka zdí).
 * - jen jeden údaj               → použije se ten.
 * Pojistky:
 * - vybraná menší < 15 m² (makléř mohl zadat jen sklep/garáž) → záznam chybný,
 *   použije se větší a nastaví se flag `invalid-small`.
 * - extrémní rozdíl (např. 20 vs 150 m²) → flag `extreme-diff` (manuální kontrola).
 */

export type AreaFlag = "invalid-small" | "extreme-diff";

export interface AreaResolution {
  area: number | null;
  estimatedAccessoryArea: number | null;
  flag: AreaFlag | null;
}

const DIFF_THRESHOLD_PCT = 15;
const MIN_LIVING_AREA = 15;
const EXTREME_DIFF_RATIO = 5;

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function resolveLivingArea(
  floorArea: number | null | undefined,
  usableArea: number | null | undefined,
): AreaResolution {
  const hasFloor = typeof floorArea === "number" && Number.isFinite(floorArea) && floorArea > 0;
  const hasUsable = typeof usableArea === "number" && Number.isFinite(usableArea) && usableArea > 0;

  if (!hasFloor && !hasUsable) {
    return { area: null, estimatedAccessoryArea: null, flag: null };
  }

  // Jen jeden údaj → použij ten.
  if (hasFloor !== hasUsable) {
    return {
      area: hasFloor ? (floorArea as number) : (usableArea as number),
      estimatedAccessoryArea: null,
      flag: null,
    };
  }

  const f = floorArea as number;
  const u = usableArea as number;
  const smaller = Math.min(f, u);
  const larger = Math.max(f, u);
  const diffPct = ((larger - smaller) / larger) * 100;

  // Oba údaje, rozdíl malý → rozdíl je jen tloušťka zdí, vem podlahovou plochu.
  if (diffPct <= DIFF_THRESHOLD_PCT) {
    return { area: f, estimatedAccessoryArea: null, flag: null };
  }

  // Oba údaje, rozdíl výrazný → větší zahrnuje terasu/balkon/sklep.
  const extremeDiff = larger / smaller > EXTREME_DIFF_RATIO;

  if (smaller < MIN_LIVING_AREA) {
    // Menší údaj je podezřele malý (možná jen sklep/garáž) → záznam chybný.
    return { area: larger, estimatedAccessoryArea: null, flag: "invalid-small" };
  }

  return {
    area: smaller,
    estimatedAccessoryArea: round1(larger - smaller),
    flag: extremeDiff ? "extreme-diff" : null,
  };
}

/**
 * Aplikuje resolver na RawListing: opraví `area`, přepočítá `pricePerSqm`
 * z opravené plochy a vrátí odhad příslušenství + flag pro uložení do DB.
 */
export function applyAreaResolution(listing: RawListing): {
  resolved: RawListing;
  accessoryArea: number | null;
  flag: AreaFlag | null;
} {
  const resolution = resolveLivingArea(listing.floorArea, listing.usableArea);

  if (resolution.area == null) {
    return { resolved: listing, accessoryArea: null, flag: null };
  }

  const pricePerSqm =
    listing.price > 0 ? Math.round(listing.price / resolution.area) : null;

  return {
    resolved: { ...listing, area: resolution.area, pricePerSqm },
    accessoryArea: resolution.estimatedAccessoryArea,
    flag: resolution.flag,
  };
}