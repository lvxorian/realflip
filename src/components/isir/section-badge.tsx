"use client";

import { cn } from "@/lib/utils";

const SECTION_CONFIG: Record<string, { label: string; className: string }> = {
  A: { label: "A — Podnět", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  B: { label: "B — Rozhodnutí", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  D: { label: "D — Zpeněžení", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
};

export function SectionBadge({ section, className }: { section: string | null; className?: string }) {
  if (!section) return null;
  const config = SECTION_CONFIG[section.toUpperCase()];
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
