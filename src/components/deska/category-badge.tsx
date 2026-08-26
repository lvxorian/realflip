import { cn } from "@/lib/utils";

type Category = "PRODEJ" | "DRAZBA" | "EXEKUCE" | "DEDICTVI" | "STAVEBNI_RIZENI" | "JINE";

const CATEGORY_CONFIG: Record<Category, { label: string; className: string }> = {
  PRODEJ: {
    label: "Prodej",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  DRAZBA: {
    label: "Dražba",
    className: "bg-red-500/15 text-red-400 border-red-500/20",
  },
  EXEKUCE: {
    label: "Exekuce",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  },
  DEDICTVI: {
    label: "Dědictví",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  STAVEBNI_RIZENI: {
    label: "Stavební",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
  JINE: {
    label: "Jiné",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  },
};

export function CategoryBadge({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const config = CATEGORY_CONFIG[category as Category] ?? CATEGORY_CONFIG.JINE;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export function RelevanceBadge({
  relevance,
  className,
}: {
  relevance: string;
  className?: string;
}) {
  const config =
    relevance === "HIGH"
      ? { label: "Vysoká", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" }
      : relevance === "MEDIUM"
        ? { label: "Střední", className: "bg-sky-500/15 text-sky-400 border-sky-500/20" }
        : { label: "Nízká", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
