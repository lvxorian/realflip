/**
 * Cenový rating Realingo/Valuo — JEDINÝ zdroj pravdy pro barvy i popisky.
 * Label přichází z API verbatim (`loadPriceStats.stats.label`); hodnoty se
 * nikde nepřepočítávají — co ukazuje Realingo, to ukazujeme my.
 */

export type RatingBadge = "success" | "default" | "warning" | "danger";

export interface RatingMeta {
  badge: RatingBadge;
  /** Třída pro barevný strip pod cenou (PriceRatingStrip). */
  strip: string;
  /** Pořadí tier 1..5 = barva od "nejlepší cena" po "nejdražší". */
  tier: number;
}

export const RATING_META: Record<string, RatingMeta> = {
  "Velmi dobrá cena": {
    badge: "success",
    tier: 1,
    strip: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  },
  "Dobrá cena": {
    badge: "success",
    tier: 2,
    strip: "bg-green-500/10 text-green-500/90 border border-green-500/25",
  },
  "Férová cena": {
    badge: "default",
    tier: 3,
    strip: "bg-slate-400/10 text-slate-300 border border-slate-400/25",
  },
  "Vyšší cena": {
    badge: "warning",
    tier: 4,
    strip: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  "Vysoká cena": {
    badge: "danger",
    tier: 5,
    strip: "bg-red-500/15 text-red-400 border border-red-500/30",
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
