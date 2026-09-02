import { cn } from "@/lib/utils";
import { ratingMeta } from "@/lib/realingo/rating";
// /ssr barrel — komponenta se renderuje i v RSC (detail stránka)

interface PriceRatingMeterProps {
  /** Label ve slovníku webu Realinga („Vynikající cena" …). Bez ratingu se nic nevykreslí. */
  label: string | null | undefined;
  /** `bar` = jen ukazatel (husté seznamy), `full` = ukazatel + barevný popisek. */
  variant?: "bar" | "full";
  size?: "sm" | "md";
  className?: string;
}

const SEGMENTS = 5;

/**
 * Segmentový ukazatel férovosti ceny (5 dílků) — styl Realinga: plný bar =
 * nejlepší cena (zelená), ubývající dílky až po červenou. Barva i počet
 * plných dílků jedou z RATING_META (source of truth), nic se nepřepočítává.
 */
export function PriceRatingMeter({
  label,
  variant = "full",
  size = "sm",
  className,
}: PriceRatingMeterProps) {
  const meta = ratingMeta(label);
  if (!meta) return null;
  const text = meta.meter.text;
  return (
    <span
      className={cn(
        "inline-flex items-center",
        variant === "full" && "gap-1.5",
        className
      )}
      title={`Cenové hodnocení: ${label!.trim()}`}
    >
      <span aria-hidden className={cn("grid grid-cols-5 gap-[2px]", size === "sm" ? "w-12" : "w-24")}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-[1px] transition-colors",
              size === "sm" ? "h-1" : "h-1.5",
              i < meta.meter.filled ? meta.meter.bar : "bg-white/[0.07]"
            )}
          />
        ))}
      </span>
      {variant === "full" ? (
        <span
          className={cn(
            "font-medium leading-none",
            size === "sm" ? "text-[11px]" : "text-xs",
            text
          )}
        >
          {label!.trim()}
        </span>
      ) : (
        <span className="sr-only">{label!.trim()}</span>
      )}
    </span>
  );
}
