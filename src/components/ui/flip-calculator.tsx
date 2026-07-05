"use client";

import { useState } from "react";
import { CaretDown, CaretUp, Calculator } from "@phosphor-icons/react";

interface FlipCalculatorProps {
  initialPrice: number;
  renovationCost: number;
}

function fmt(p: number) {
  return `${(p / 1000000).toFixed(1)} mil. Kč`;
}

export function FlipCalculator({ initialPrice, renovationCost }: FlipCalculatorProps) {
  const [open, setOpen] = useState(true);
  const [purchasePrice, setPurchasePrice] = useState(initialPrice);
  const [renoLevel, setRenoLevel] = useState<"light" | "medium" | "full">("medium");

  const renoMultiplier = renoLevel === "light" ? 0.6 : renoLevel === "medium" ? 1 : 1.6;
  const adjustedReno = Math.round(renovationCost * renoMultiplier);
  const legalTax = Math.round(purchasePrice * 0.08);
  const reserve = Math.round(adjustedReno * 0.1);
  const total = purchasePrice + adjustedReno + legalTax + reserve;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full"
      >
        <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2">
          <Calculator size={16} className="text-accent" weight="duotone" />
          Kalkulátor
        </h2>
        {open ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
      </button>
      {open && (
        <div className="space-y-3 mt-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Kupní cena</label>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Number(e.target.value))}
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Rozsah rekonstrukce</label>
            <div className="flex gap-1">
              {(["light", "medium", "full"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setRenoLevel(level)}
                  className={`flex-1 py-2 text-xs rounded-lg border transition-all ${
                    renoLevel === level
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border/50 text-muted hover:border-accent/30"
                  }`}
                >
                  {level === "light" ? "Lehká" : level === "medium" ? "Střední" : "Kompletní"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 pt-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>Rekonstrukce</span>
              <span>{fmt(adjustedReno)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Právní + daň (8 %)</span>
              <span>{fmt(legalTax)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Rezerva (10 %)</span>
              <span>{fmt(reserve)}</span>
            </div>
            <div className="border-t border-border/30 pt-1.5 flex justify-between font-semibold">
              <span>Celkové náklady</span>
              <span className="font-mono">{fmt(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
