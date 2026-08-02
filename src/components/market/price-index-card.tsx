"use client";

import { useEffect, useState } from "react";
import { TrendUp, TrendDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface SegmentIndex {
  key: string;
  label: string;
  current: number;
  indexValue: number;
  sampleSize: number;
  changePct: number | null;
}

interface PriceIndexData {
  segments: SegmentIndex[];
  marketTrend: number | null;
  points: { period: string; value: number }[];
}

function fmt(v: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(v);
}

export function PriceIndexCard() {
  const [data, setData] = useState<PriceIndexData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market/price-index", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: PriceIndexData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="h-5 w-48 rounded bg-border/20 animate-pulse mb-3" />
        <div className="h-24 rounded-xl bg-border/10 animate-pulse" />
      </div>
    );
  }

  if (!data || data.segments.length === 0) {
    return null;
  }

  const min = Math.min(...data.points.map((p) => p.value));
  const max = Math.max(...data.points.map((p) => p.value));
  const range = max - min || 1;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendUp size={16} className="text-accent" weight="duotone" />
        <span className="font-medium">RealFlip cenovĂ˝ index</span>
        <span className="text-xs text-muted ml-auto">
          {data.marketTrend != null ? (
            <span className={cn("font-mono flex items-center gap-1", data.marketTrend >= 0 ? "text-emerald-400" : "text-red-400")}>
              {data.marketTrend >= 0 ? <TrendUp size={12} weight="bold" /> : <TrendDown size={12} weight="bold" />}
              {data.marketTrend >= 0 ? "+" : ""}{data.marketTrend} % meziroÄŤnÄ›
            </span>
          ) : (
            "index 100 = zĂˇklad"
          )}
        </span>
      </div>

      {data.points.length > 1 && (
        <div className="mb-5">
          <div className="flex items-end gap-1 h-24">
            {data.points.map((p) => (
              <div key={p.period} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[9px] font-mono text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity">{p.value}</span>
                <div
                  className="w-full rounded-t bg-accent/20 hover:bg-accent/40 transition-colors"
                  style={{ height: `${((p.value - min) / range) * 100}%` }}
                  title={`${p.period}: ${p.value}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-muted/40 mt-1 font-mono">
            <span>{data.points[0].period}</span>
            <span>{data.points[data.points.length - 1].period}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {data.segments.map((s) => (
          <div key={s.key} className="rounded-xl bg-card-hover/60 border border-border/50 px-3 py-2.5">
            <p className="text-[11px] text-muted">{s.label}</p>
            <p className="text-sm font-semibold font-mono mt-0.5">{fmt(s.current)} KÄŤ/mÂ˛</p>
            <p className="text-[10px] text-muted/50 font-mono">
              index {s.indexValue} Â· {s.sampleSize} vzorkĹŻ
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
