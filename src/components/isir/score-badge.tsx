"use client";

import { cn, investmentScoreColor, investmentScoreBg } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
        investmentScoreBg(score),
        investmentScoreColor(score),
        className
      )}
    >
      {score}
    </span>
  );
}
