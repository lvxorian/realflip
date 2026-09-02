/**
 * Cenový rating Realingo/Valuo — JEDINÝ zdroj pravdy pro barvy i popisky.
 *
 * Pozor na drift: `loadPriceStats.stats.label` vrací STARŠÍ slovník
 * (tier 1 = „Velmi dobrá cena"), ale web Realinga si tier mapuje sám
 * (tier 1 = „Vynikající cena"). Ukládáme i zobrazujeme slovník WEBU
 * (`normalizeRatingLabel`) — co ukazuje Realingo, to ukazujeme my.
 */

export type RatingBadge = "success" | "default" | "warning" | "danger";

export interface RatingMeta {
  badge: RatingBadge;
  /** Pořadí tier 1..5 = barva od "nejlepší cena" po "nejdražší". */
  tier: number;
  /** Segmentový ukazatel (PriceRatingMeter): plné dílky 1..5 a barva úrovně. */
  meter: {
    /** Solidní barva plných dílků (souvázané s Realingo #00A368→#E30000). */
    bar: string;
    /** Barva popisku/kontextu. */
    text: string;
    /** Počet plných dílků z 5 (tier 1 = 5 = nejlepší). */
    filled: number;
  };
}

/** Mapa tier → popisek přesně podle frontendu Realinga (chunk _app, mapa `u`). */
export const TIER_LABEL: Record<string, string> = {
  "1": "Vynikající cena",
  "2": "Dobrá cena",
  "3": "Férová cena",
  "4": "Vyšší cena",
  "5": "Vysoká cena",
};

/** Znormalizuje API label na slovník webu; neznámý tier → originální label. */
export function normalizeRatingLabel(
  label: string | null | undefined,
  tier: string | number | null | undefined
): string | null {
  const t = tier == null ? null : String(tier);
  return (t && TIER_LABEL[t]) || label?.trim() || null;
}

export const RATING_META: Record<string, RatingMeta> = {
  "Vynikající cena": {
    badge: "success",
    tier: 1,
    meter: { bar: "bg-emerald-500", text: "text-emerald-400", filled: 5 },
  },
  // legacy slovník API (staré řádky v DB / neznormalizované zdroje) — alias tier 1
  "Velmi dobrá cena": {
    badge: "success",
    tier: 1,
    meter: { bar: "bg-emerald-500", text: "text-emerald-400", filled: 5 },
  },
  "Dobrá cena": {
    badge: "success",
    tier: 2,
    meter: { bar: "bg-green-500", text: "text-green-400", filled: 4 },
  },
  "Férová cena": {
    badge: "default",
    tier: 3,
    meter: { bar: "bg-lime-500", text: "text-lime-400", filled: 3 },
  },
  "Vyšší cena": {
    badge: "warning",
    tier: 4,
    meter: { bar: "bg-amber-500", text: "text-amber-400", filled: 2 },
  },
  "Vysoká cena": {
    badge: "danger",
    tier: 5,
    meter: { bar: "bg-red-500", text: "text-red-400", filled: 1 },
  },
};

export function ratingMeta(label: string | null | undefined): RatingMeta | null {
  if (!label) return null;
  return RATING_META[label.trim()] ?? null;
}

/** Badge varianta pro neznámý label — neutral, ať UI nespadne na novém slově. */
export function ratingBadgeVariant(label: string | null | undefined): RatingBadge {
  return ratingMeta(label)?.badge ?? "default";
}
