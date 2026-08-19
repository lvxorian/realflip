"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartLineUp, ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { MacroData } from "@/lib/market/radar-query";

const REPO_COLOR = "#f59e0b";
const MORTGAGE_COLOR = "#ef4444";
const EMERALD = "#34d399";
const RED = "#f87171";

function shortPeriod(p: string): string {
  const [y, m] = p.split("-");
  return `${Number(m)}/${y.slice(2)}`;
}

function pctTick(v: number): string {
  return `${v} %`;
}

export function MacroCharts({ data }: { data: MacroData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.kpis.map((k) => (
          <div key={k.key} className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted">{k.label}</span>
              {k.value >= 0 ? (
                <ArrowUp size={14} className={cn(k.key === "realWage" || k.key === "mortgage" || k.key === "repo" ? "text-muted" : "text-emerald-400")} />
              ) : (
                <ArrowDown size={14} className="text-red-400" />
              )}
            </div>
            <p className="text-xl font-semibold font-mono tracking-tight">{k.value} <span className="text-sm text-muted">{k.unit}</span></p>
            <p className="text-xs text-muted mt-1">{k.period}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ChartLineUp size={16} className="text-accent" weight="duotone" />
            <span className="font-medium">Sazby: hypoteční vs repo</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.rates} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="period" tickFormatter={shortPeriod} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" />
                <YAxis tickFormatter={pctTick} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" domain={["auto", "auto"]} />
                <Tooltip
                  labelFormatter={(l) => String(l)}
                  formatter={(value, name) => [`${String(value)} %`, name === "mortgage" ? "Hypoteční" : "Repo"]}
                  contentStyle={{ background: "rgba(10,10,14,0.92)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 12, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="mortgage" stroke={MORTGAGE_COLOR} strokeWidth={2} dot={false} name="Hypoteční" />
                <Line type="monotone" dataKey="repo" stroke={REPO_COLOR} strokeWidth={2} dot={false} name="Repo" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ChartLineUp size={16} className="text-accent" weight="duotone" />
            <span className="font-medium">Yield gap (hypoteční − repo)</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.gaps} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMERALD} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={EMERALD} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="period" tickFormatter={shortPeriod} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" />
                <YAxis tickFormatter={pctTick} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" />
                <Tooltip
                  labelFormatter={(l) => String(l)}
                  formatter={(value) => [`${String(value)} p.b.`]}
                  contentStyle={{ background: "rgba(10,10,14,0.92)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 12, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="gap"
                  stroke={EMERALD}
                  strokeWidth={2}
                  fill="url(#gapFill)"
                  dot={false}
                  name="Yield gap"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 xl:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <ChartLineUp size={16} className="text-accent" weight="duotone" />
            <span className="font-medium">Inflace vs reálné mzdy (meziročně)</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cpiReal} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="period" tickFormatter={shortPeriod} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" />
                <YAxis tickFormatter={pctTick} tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.4)" />
                <Tooltip
                  labelFormatter={(l) => String(l)}
                  formatter={(value, name) => [`${String(value)} %`, name === "cpi" ? "Inflace (CPI)" : "Reálné mzdy"]}
                  contentStyle={{ background: "rgba(10,10,14,0.92)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 12, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="cpi" fill={RED} radius={[4, 4, 0, 0]} name="Inflace (CPI)" />
                <Bar dataKey="realWage" fill={EMERALD} radius={[4, 4, 0, 0]} name="Reálné mzdy" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}