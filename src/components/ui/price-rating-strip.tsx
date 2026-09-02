import { cn } from "@/lib/utils";
import { ratingMeta } from "@/lib/realingo/rating";
// /ssr barrel — komponenta se renderuje i v RSC (detail stránka)
import { TrendDown, Minus, TrendUp } from "@phosphor-icons/react/ssr";

interface PriceRatingStripProps {
  /** Verbatim label z Realinga („Velmi dobrá cena" …). Bez ratingu se nic nevykreslí. */
  label: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Barevný indikátor férovosti ceny pod cenou — styl jako Realingo
 * (každý typ ceny vlastní barvu): zelená = pod trhem, neutrální = férová,
 * oranžová/červená = nad trhem.
 */
export function PriceRatingStrip({ label, size = "sm", className }: PriceRatingStripProps) {
  const meta = ratingMeta(label);
  if (!meta) return null;
  const Icon = meta.tier <= 2 ? TrendDown : meta.tier === 3 ? Minus : TrendUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.strip,
        className
      )}
    >
      <Icon size={size === "sm" ? 11 : 13} weight="bold" />
      {label!.trim()}
    </span>
  );
}
