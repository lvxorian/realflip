"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Copy,
  FilePdf,
  SealCheck,
  Sparkle,
} from "@phosphor-icons/react";
import { conditionLabel } from "@/lib/utils";
import type { ValuationAiOutput, ValuationInput, ValuationResult } from "@/lib/valuation/types";

const fmtPrice = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v).toLocaleString("cs-CZ")} Kč`;

const fmtCompact = (v: number | null | undefined) => {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} mil.`;
  if (v >= 1_000) return `${Math.round(v / 1_000).toLocaleString("cs-CZ")} tis.`;
  return v.toLocaleString("cs-CZ");
};

const CONFIDENCE_STYLE: Record<string, { badge: string; text: string }> = {
  Vysoká: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", text: "text-emerald-400" },
  Střední: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/30", text: "text-amber-400" },
  Nízká: { badge: "bg-red-500/10 text-red-400 border-red-500/30", text: "text-red-400" },
};

interface Props {
  result: ValuationResult;
  ai: ValuationAiOutput | null;
  fields: ValuationInput;
  onPrintReport: () => void;
}

export default function ValuationResultView({ result, ai, fields, onPrintReport }: Props) {
  const [copied, setCopied] = useState(false);
  const conf = CONFIDENCE_STYLE[result.confidenceLabel] ?? CONFIDENCE_STYLE.Nízká;

  const rangeMin = result.low * 0.95;
  const rangeMax = result.high * 1.05;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - rangeMin) / (rangeMax - rangeMin)) * 100))}%`;

  const copySummary = async () => {
    const text = [
      `Odhad ceny: ${fmtPrice(result.low)} – ${fmtPrice(result.high)} (medián ${fmtPrice(result.estimate)})`,
      `Spolehlivost: ${result.confidenceLabel} (${result.confidenceScore}/100)`,
      `${fields.address ?? ""}${fields.cityName ? ", " + fields.cityName : ""}`.trim(),
      ...(result.vsAskingPct != null ? [`Inzerovaná cena: ${fmtPrice(result.askingPrice)} (odhad ${result.vsAskingPct >= 0 ? "+" : ""}${result.vsAskingPct} %)`] : []),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trendData = useMemo(() => {
    const last = result.trend.slice(-12);
    return last.map((t) => ({ name: t.monthYear, cena: t.price }));
  }, [result.trend]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Hero */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted font-medium">Odhad tržní hodnoty</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-1 tabular-nums">{fmtPrice(result.estimate)}</h2>
              <p className="text-sm text-muted mt-1 tabular-nums">
                rozmezí {fmtPrice(result.low)} – {fmtPrice(result.high)}
              </p>
              <p className="text-xs text-muted/70 mt-0.5 tabular-nums">
                {Math.round(result.lowPerSqm).toLocaleString("cs-CZ")} – {Math.round(result.highPerSqm).toLocaleString("cs-CZ")} Kč/m² · medián {Math.round(result.pricePerSqm).toLocaleString("cs-CZ")} Kč/m²
              </p>
              {(fields.address || fields.cityName) && (
                <p className="text-sm text-muted/80 mt-2">
                  {[fields.address, fields.cityName].filter(Boolean).join(", ")}
                  {fields.disposition ? ` · ${fields.disposition}` : ""}
                  {fields.area ? ` · ${fields.area} m²` : ""}
                  {fields.condition ? ` · ${conditionLabel(fields.condition)}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${conf.badge}`}>
                <SealCheck size={14} weight="fill" />
                Spolehlivost: {result.confidenceLabel} · {result.confidenceScore}/100
              </span>
              {result.vsAskingPct != null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                    result.vsAskingPct >= 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {result.vsAskingPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  Odhad {result.vsAskingPct >= 0 ? "nad" : "pod"} inzerátem o {Math.abs(result.vsAskingPct).toFixed(1)} %
                </span>
              )}
            </div>
          </div>

          {/* Range bar */}
          <div className="mt-6">
            <div className="relative h-2 rounded-full bg-gradient-to-r from-amber-500/60 via-emerald-500/60 to-emerald-400/70">
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow-lg"
                style={{ left: pos(result.estimate) }}
                title="Medián"
              />
            </div>
            <div className="flex justify-between text-xs text-muted mt-2 tabular-nums">
              <span>{fmtCompact(result.low)}</span>
              <span className="font-medium text-foreground">{fmtCompact(result.estimate)}</span>
              <span>{fmtCompact(result.high)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted/60 mt-1 tabular-nums">
              <span>{Math.round(result.lowPerSqm).toLocaleString("cs-CZ")} Kč/m²</span>
              <span className="font-medium text-foreground/70">{Math.round(result.pricePerSqm).toLocaleString("cs-CZ")} Kč/m²</span>
              <span>{Math.round(result.highPerSqm).toLocaleString("cs-CZ")} Kč/m²</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Button onClick={onPrintReport} className="flex items-center gap-2">
              <FilePdf size={16} weight="bold" />
              PDF report
            </Button>
            <Button variant="secondary" size="sm" onClick={copySummary} className="flex items-center gap-2">
              <Copy size={14} />
              {copied ? "Zkopírováno" : "Kopírovat souhrn"}
            </Button>
            <span className="text-xs text-muted ml-auto">Vygenerováno {new Date(result.generatedAt).toLocaleTimeString("cs-CZ")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Zdroje */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Zdroje odhadu</h3>
          <div className="space-y-3">
            {result.sources.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-card-hover/40 px-4 py-3"
                title={s.note}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  <p className="text-xs text-muted truncate">
                    {s.sampleSize ? `${s.sampleSize.toLocaleString("cs-CZ")} vzorků` : "—"} · váha {Math.round(s.weight * 100)} %
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">
                  {s.pricePerSqm ? `${Math.round(s.pricePerSqm).toLocaleString("cs-CZ")} Kč/m²` : "—"}
                </p>
              </div>
            ))}
          </div>
          {result.csuzIndex && (
            <p className="text-xs text-muted mt-3">
              Kontext trhu: {result.csuzIndex.note} — ČR {result.csuzIndex.value.toLocaleString("cs-CZ")}, Praha{" "}
              {result.csuzIndex.praha.toLocaleString("cs-CZ")}; meziroční růst +{result.csuzIndex.growthPct.toLocaleString("cs-CZ")} % (ČSÚ).
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Srovnatelné */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4">Srovnatelné nemovitosti</h3>
            {result.comparables.length === 0 ? (
              <p className="text-sm text-muted">Žádné srovnatelné nabídky v okolí.</p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted">
                      <th className="py-2 pr-3 font-medium">Nemovitost</th>
                      <th className="py-2 pr-3 text-right font-medium">m²</th>
                      <th className="py-2 pr-3 text-right font-medium">Cena</th>
                      <th className="py-2 text-right font-medium">Kč/m²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {result.comparables.slice(0, 12).map((c, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3">
                          <p className="text-xs truncate max-w-[180px]">{c.label}</p>
                          <p className="text-[10px] text-muted">
                            {c.source === "realized" ? "realizované prodeje" : "nabídka"}
                            {c.distanceKm != null ? ` · ${c.distanceKm.toFixed(1)} km` : ""}
                          </p>
                        </td>
                        <td className="py-2 pr-3 text-right text-muted tabular-nums">{c.area ? c.area : "—"}</td>
                        <td className="py-2 pr-3 text-right text-muted tabular-nums">{c.price ? fmtCompact(c.price) : "—"}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {Math.round(c.pricePerSqm).toLocaleString("cs-CZ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-1">Vývoj cen bytů v ČR</h3>
            <p className="text-xs text-muted mb-4">Realizované prodeje, Seznam cenová mapa (12 měsíců)</p>
            {trendData.length >= 2 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString("cs-CZ")} Kč/m²`, "Průměrná cena"]}
                      contentStyle={{ background: "#17171a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Line type="monotone" dataKey="cena" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted">Trend není k dispozici.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI */}
      {ai && (
        <Card>
          <CardContent className="p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Sparkle size={16} weight="fill" className="text-accent" />
              AI hodnocení
            </h3>
            <p className="text-sm text-foreground/90 leading-relaxed">{ai.summary}</p>
            {ai.drivers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {ai.drivers.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card-hover px-2.5 py-1 text-xs text-muted">
                    <CheckCircle size={12} className="text-accent" />
                    {d}
                  </span>
                ))}
              </div>
            )}
            {ai.caveats.length > 0 && (
              <p className="text-xs text-amber-400/90 mt-3">{ai.caveats.join(" ")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metodika + disclaimer */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-3">Metodika</h3>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted">
            {result.methodology.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ol>
          <p className="text-xs text-muted/70 mt-4">
            Odhad je orientační, založený na veřejných datech. Nenahrazuje znalecký posudek.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
