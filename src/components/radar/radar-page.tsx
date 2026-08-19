"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChartLineUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { RadarData } from "@/lib/market/radar-query";
import { MacroCharts } from "@/components/radar/macro-charts";
import { RegionsTab } from "@/components/radar/regions-tab";
import { CitiesTab } from "@/components/radar/cities-tab";
import { ReportCard } from "@/components/radar/report-card";

const tabs = [
  { key: "trh", label: "Trh" },
  { key: "regiony", label: "Regiony" },
  { key: "mesta", label: "Města" },
];

const ranges = [
  { key: "1q", label: "3M" },
  { key: "1y", label: "1R" },
  { key: "3y", label: "3R" },
  { key: "5y", label: "5R" },
];

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState("trh");
  const [range, setRange] = useState("1y");
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market/radar?range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && typeof d === "object" && d.macro) {
          setData(d);
          setError(false);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Radar</h1>
          <p className="text-sm text-muted mt-1">Makroekonomický a regionální přehled trhu</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1 ml-auto">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                setRange(r.key);
                setLoading(true);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                range === r.key ? "bg-accent text-white" : "text-muted hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card p-1 w-fit">
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
              )}
            >
              <ChartLineUp size={15} weight={isActive ? "fill" : "regular"} />
              {t.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {loading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-5">
                <div className="h-4 w-24 rounded bg-border/20 animate-pulse mb-3" />
                <div className="h-7 w-20 rounded bg-border/10 animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted">Data se nepodařilo načíst.</p>
        ) : (
          <div className="space-y-6">
            <ReportCard regionKey="cr" range={range} />
            {activeTab === "trh" && <MacroCharts data={data.macro} />}
            {activeTab === "regiony" && <RegionsTab priceMap={data.priceMap} supply={data.supply} />}
            {activeTab === "mesta" && <CitiesTab flow={data.listingFlow} cities={data.cities} />}
          </div>
        )}
      </motion.div>
    </div>
  );
}