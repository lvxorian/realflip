"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PctStepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
}

/** Přesné nastavení procentní hodnoty: tlačítka −/+ (krok 0.1)
 *  + číselné pole pro ruční zadání. Hodnota se vždy zaokrouhlí na
 *  desetinu (ochrana proti float driftu 21.1 + 0.1 = 21.20000000003). */
export function PctStepper({ value, onChange, min, max, step = 0.1, className }: PctStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 10) / 10));

  const stepBy = (dir: 1 | -1) => {
    const next = clamp(value + dir * step);
    if (next !== value) onChange(next);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  const btnCls =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-card-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/80";

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border/40 bg-card-hover/40 px-0.5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => stepBy(-1)}
        disabled={atMin}
        aria-label="Snížit o 0,1 %"
        className={btnCls}
      >
        <Minus size={12} weight="bold" />
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          if (Number.isNaN(raw)) return;
          onChange(clamp(raw));
        }}
        onBlur={(e) => {
          const raw = parseFloat(e.target.value);
          onChange(clamp(Number.isNaN(raw) ? min : raw));
        }}
        className="h-6 w-[4.5ch] min-w-0 border-none bg-transparent text-right font-mono text-sm tabular-nums text-foreground focus:outline-none"
      />
      <button
        type="button"
        onClick={() => stepBy(1)}
        disabled={atMax}
        aria-label="Zvýšit o 0,1 %"
        className={btnCls}
      >
        <Plus size={12} weight="bold" />
      </button>
    </div>
  );
}
