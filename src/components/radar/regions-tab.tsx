"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MapPin, HouseLine } from "@phosphor-icons/react";
import type { PriceMapRegionRow, SupplyRegionRow } from "@/lib/market/radar-query";
import { regionLabel } from "@/lib/market/radar-shared";

const ACCENT = "#6366f1";

const fmtKc = (v: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(v);

function shortRegion(name: string): string {
  return name
    .replace("Hlavní město Praha", "Praha")
    .replace(" kraj", "")
    .replace("Kraj Vysočina", "Vysočina");
}

function axisTick(v: string): string {
  return shortRegion(v).slice(0, 10);
}

export function RegionsTab({ priceMap, supply }: { priceMap: PriceMapRegionRow[]; supply: SupplyRegionRow[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-accent" weight="duotone" />
          <span className="font-medium">Realizované ceny bytů dle krajů (cenová mapa)</span>
        </div>
        {priceMap.length === 0 ? (
          <p className="text-sm text-muted">Cenová mapa není dostupná.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceMap} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="name" tickFormatter={axisTick} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" interval="preserveStartEnd" angle={-35} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" />
                <Tooltip
                  formatter={(value, name) => [`${fmtKc(Number(value))} Kč/m²`, name === "pricePerSqm" ? "Cena" : "Transakce"]}
                  labelFormatter={(l) => String(l)}
                  contentStyle={{ background: "rgba(10,10,14,0.92)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="pricePerSqm" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <HouseLine size={16} className="text-accent" weight="duotone" />
          <span className="font-medium">Zahájené byty vs přírůstek obyvatel</span>
          <span className="text-xs text-muted ml-auto">
            {supply[0] ? `rok ${supply[0].year}` : "—"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left p-3 text-xs text-muted font-medium">Kraj</th>
                <th className="text-right p-3 text-xs text-muted font-medium">Zahájené byty</th>
                <th className="text-right p-3 text-xs text-muted font-medium">Přírůstek obyvatel</th>
                <th className="text-right p-3 text-xs text-muted font-medium hidden sm:table-cell">Byty / 0,01 p.b. růstu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {supply.map((s) => (
                <tr key={s.regionKey} className="hover:bg-card-hover transition-colors">
                  <td className="p-3 font-medium">{regionLabel(s.regionKey)}</td>
                  <td className="p-3 text-right font-mono">{fmtKc(s.started)}</td>
                  <td className={cnValue(s.popGrowth)}>{s.popGrowth > 0 ? "+" : ""}{s.popGrowth.toFixed(2)} %</td>
                  <td className="p-3 text-right font-mono text-muted hidden sm:table-cell">
                    {s.popGrowth !== 0 ? fmtKc(Math.round(s.started / Math.abs(s.popGrowth) / 100)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function cnValue(v: number): string {
  return `p-3 text-right font-mono ${v >= 0 ? "text-emerald-400" : "text-red-400"}`;
}