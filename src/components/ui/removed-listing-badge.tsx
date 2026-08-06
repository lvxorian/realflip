"use client";

import { Prohibit } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface RemovedListingBadgeProps {
  neutral?: boolean;
  className?: string;
}

/**
 * Štítek "INZERÁT ODSTRANĚN" pro nemovitosti, které zmizely z portálu.
 * `neutral` = informativní varianta (deal uzavřen/ztracen), jinak jantarová
 * varovná varianta (aktivní fáze pipeline — pravděpodobně prodáno jinému).
 */
export function RemovedListingBadge({ neutral = false, className }: RemovedListingBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase whitespace-nowrap",
        neutral
          ? "border-border/60 bg-card text-muted"
          : "border-amber-500/40 bg-amber-500/10 text-amber-500",
        className
      )}
    >
      <Prohibit size={12} weight="fill" />
      Inzerát odstraněn
    </span>
  );
}