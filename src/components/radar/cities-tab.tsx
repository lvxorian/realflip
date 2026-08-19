"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { ListMagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { CityHeatmapRow, ListingFlowPoint } from "@/lib/market/radar-query";

const EMERALD = "#34d399";
const RED = "#f87171";

const fmt = (v: number) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(v);

function shortPeriod(p: string): string {
  const [y, m] = p.split("-");
  return `${Number(m)}/${y.slice(2)}`;
}

function heatColor(ratio: number, min: number, max: number): string {
  // ratio 0..1 → zelená → žlutá → červená (levné → drahé)
  const t = Math.max(0, Math.min(1, (ratio - min) / (max - min || 1)));
  const r = Math.round(34 + (t * (239 - 34)));
  const g = Math.round(211 - (t * (211 - 68)));
  const b = Math.round(153 - (t * (153 - 68)));
  return `rgba(${r}, ${g}, ${b}, 0.22)`;
}

export function CitiesTab({ flow, cities }: { flow: ListingFlowPoint[]; cities: CityHeatmapRow[] }) {
  const prices = cities.map((c) => c.pricePerSqm).filter((v) => v > 0);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const max = prices.length > 0 ? Math.max(...prices) : 1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ListMagnifyingGlass size={16} className="text-accent" weight="duotone" />
          <span className="font-medium">Nové vs stažené inzeráty (vlastní sledování)</span>
        </div>
        {flow.length === 0 ? (
          <p className="text-sm text-muted">Zatím žádná vlastní data.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="period" tickFormatter={shortPeriod} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" allowDecimals={false} />
                <Tooltip
                  labelFormatter={(l) => String(l)}
                  formatter={(value, name) => [String(value), name === "nove" ? "Nové" : "Stažené"]}
                  contentStyle={{ background: "rgba(10,10,14,0.92)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 12, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="nove" fill={EMERALD} radius={[4, 4, 0, 0]} name="Nové" />
                <Bar dataKey="stazene" fill={RED} radius={[4, 4, 0, 0]} name="Stažené" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListMagnifyingGlass size={16} className="text-accent" weight="duotone" />
            <span className="font-medium">Města — cena/m² a price-to-rent</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted font-mono">
            <span>levné</span>
            <div className="w-20 h-2 rounded bg-gradient-to-r from-emerald-400/60 via-yellow-500/60 to-red-400/60" />
            <span>drahé</span>
          </div>
        </div>
        {cities.length === 0 ? (
          <p className="text-sm text-muted">Zatím žádná data o městech.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cities.map((c) => (
              <div
                key={c.cityKey}
                className="rounded-xl border border-border/50 p-4 transition-colors hover:bg-card-hover"
                style={{ background: heatColor(c.pricePerSqm, min, max) }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{c.name}</span>
                  <span className="text-xs text-muted">{c.listings} inz.</span>
                </div>
                <p className="font-mono text-lg font-semibold tracking-tight">{fmt(c.pricePerSqm)} <span className="text-xs text-muted font-normal">Kč/m²</span></p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-muted">
                  {c.rentPerSqm != null && <span>nájem {fmt(c.rentPerSqm)} Kč/m²</span>}
                  {c.priceToRent != null && (
                    <span className={cn("font-mono", c.priceToRent <= 20 ? "text-emerald-400" : c.priceToRent <= 25 ? "text-amber-400" : "text-red-400")}>
                      P/R {c.priceToRent} let
                    </span>
                  )}
                  {c.share65plus != null && <span>65+ {c.share65plus} %</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}