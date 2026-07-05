import { cn } from "@/lib/utils";

interface PriceTagProps {
  price: number;
  size?: "sm" | "md" | "lg";
  perSqm?: number;
  className?: string;
  locale?: string;
}

export function PriceTag({ price, size = "md", perSqm, className, locale = "cs-CZ" }: PriceTagProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(v);

  const sizeClasses = {
    sm: "text-sm font-semibold",
    md: "text-xl font-bold",
    lg: "text-3xl font-bold",
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("font-mono tracking-tight text-price", sizeClasses[size])}>
        {fmt(price)} Kč
      </span>
      {perSqm !== undefined && (
        <span className="text-[10px] text-muted font-mono mt-0.5">
          {fmt(perSqm)} Kč/m²
        </span>
      )}
    </div>
  );
}
