"use client";

import type { ValuationAiCorrection, ValuationInput, ValuationResult, ValuationAiOutput } from "@/lib/valuation/types";
import { conditionLabel } from "@/lib/utils";

export interface ValuationReportData {
  valuation: ValuationResult;
  fields: ValuationInput;
  ai: ValuationAiOutput | null;
  aiCorrection?: ValuationAiCorrection | null;
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `${Math.round(v).toLocaleString("cs-CZ")} Kč`;
}

function fmtPerSqm(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `${Math.round(v).toLocaleString("cs-CZ")} Kč/m²`;
}

function fmtDist(m: number | null | undefined): string {
  if (m == null || m >= 100000) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km`;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  Vysoká: "text-emerald-700",
  Střední: "text-amber-700",
  Nízká: "text-red-700",
};

export default function ValuationReport({ data }: { data: ValuationReportData }) {
  const { valuation: v, fields: f, ai, aiCorrection } = data;
  const typeLabel = f.type === "flat" ? "Byt" : f.type === "house" ? "Dům" : "Pozemek";

  return (
    <div className="max-w-3xl mx-auto">
      <style>{`
        @page { size: A4; margin: 18mm 15mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rp-card { break-inside: avoid; }
        }
      `}</style>

      {/* Hlavička */}
      <div className="rp-card border-b-2 border-gray-200 pb-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Odhad ceny nemovitosti</h1>
            <p className="text-sm text-gray-500 mt-1">
              {[f.address, f.cityName].filter(Boolean).join(", ") || "Lokalita neuvedena"}
            </p>
          </div>
          <p className="text-xs text-gray-400 text-right">
            RealFlip · {new Date(v.generatedAt).toLocaleDateString("cs-CZ")}
            <br />
            {new Date(v.generatedAt).toLocaleTimeString("cs-CZ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-600">
          <span>{typeLabel}</span>
          {f.disposition && <span>Dispozice: {f.disposition}</span>}
          {f.area && <span>Plocha: {f.area} m²</span>}
          {f.condition && <span>Stav: {conditionLabel(f.condition)}</span>}
          {f.floor != null && <span>Patro: {f.floor}</span>}
          {f.yearBuilt && <span>Rok: {f.yearBuilt}</span>}
        </div>
      </div>

      {/* Odhad */}
      <div className="rp-card border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Odhad tržní hodnoty</h2>
        </div>
        <div className="p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bodový odhad (medián)</p>
              <p className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">{fmtPrice(v.estimate)}</p>
              <p className="text-sm text-gray-500 mt-1 tabular-nums">
                {fmtPrice(v.low)} – {fmtPrice(v.high)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                {fmtPerSqm(v.lowPerSqm)} – {fmtPerSqm(v.highPerSqm)} · medián {fmtPerSqm(v.pricePerSqm)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-semibold ${CONFIDENCE_COLOR[v.confidenceLabel] ?? "text-gray-700"}`}>
                Spolehlivost: {v.confidenceLabel}
              </p>
              <p className="text-xs text-gray-500 mt-1 tabular-nums">
                {v.confidenceScore} / 100 · {fmtPerSqm(v.pricePerSqm)}
              </p>
            </div>
          </div>
          {v.vsAskingPct != null && (
            <p className="text-sm mt-3 text-gray-700">
              {v.vsAskingPct >= 0 ? "▲" : "▼"} Odhad je o{" "}
              <span className="font-semibold">{Math.abs(v.vsAskingPct).toFixed(1)} %</span>{" "}
              {v.vsAskingPct >= 0 ? "nad" : "pod"} inzerovanou cenou {fmtPrice(v.askingPrice)}.
            </p>
          )}
        </div>
      </div>

      {/* Zdroje */}
      <div className="rp-card border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Zdroje dat</h2>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {v.sources.map((s) => (
                <tr key={s.key}>
                  <td className="py-2 pr-4 text-gray-600">{s.label}</td>
                  <td className="py-2 pr-4 text-right font-mono text-gray-900 tabular-nums">{fmtPerSqm(s.pricePerSqm)}</td>
                  <td className="py-2 text-right text-gray-500 tabular-nums">
                    {s.sampleSize ? `${s.sampleSize.toLocaleString("cs-CZ")} vz.` : "—"} · váha {Math.round(s.weight * 100)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.csuzIndex && (
            <p className="text-xs text-gray-500 mt-3">
              Kontext: {v.csuzIndex.note} — ČR {v.csuzIndex.value.toLocaleString("cs-CZ")}, Praha{" "}
              {v.csuzIndex.praha.toLocaleString("cs-CZ")}; meziroční růst +{v.csuzIndex.growthPct.toLocaleString("cs-CZ")} % (ČSÚ).
            </p>
          )}
        </div>
      </div>

      {/* Doprava — Vlak Index */}
      {v.transport && v.transport.sampleSize >= 3 && (
        <div className="rp-card border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Doprava — Vlak Index</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-xs text-gray-500">Skóre dopravní dostupnosti</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{v.transport.score} / 100</p>
              </div>
              {v.transport.metroDistance != null && (
                <div>
                  <p className="text-xs text-gray-500">Metro</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtDist(v.transport.metroDistance)}</p>
                </div>
              )}
              {v.transport.trainDistance != null && (
                <div>
                  <p className="text-xs text-gray-500">Vlak</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtDist(v.transport.trainDistance)}</p>
                </div>
              )}
              {v.transport.busDistance != null && (
                <div>
                  <p className="text-xs text-gray-500">Bus / MHD</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtDist(v.transport.busDistance)}</p>
                </div>
              )}
              {v.transport.quarterLabel && (
                <div>
                  <p className="text-xs text-gray-500">Lokalita</p>
                  <p className="text-lg font-bold text-gray-900">{v.transport.quarterLabel}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Vzdálenosti k zastávkám z reálných inzerátů v lokalitě (sreality POI, {v.transport.sampleSize} vzorků)
              {v.transport.premiumPct != null
                ? ` · prémie dopravně výborných lokalit v městě ${v.transport.premiumPct > 0 ? "+" : ""}${v.transport.premiumPct} %`
                : ""}
              .
            </p>
          </div>
        </div>
      )}

      {/* Srovnatelné */}
      {v.comparables.length > 1 && (
        <div className="rp-card border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Srovnatelné nemovitosti</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Nemovitost</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Plocha</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Cena</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Kč/m²</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Odhad</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Zdroj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {v.comparables.slice(0, 12).map((c, i) => {
                  const ratio = v.pricePerSqm > 0 ? Math.round((c.pricePerSqm / v.pricePerSqm) * 100) : null;
                  const outlier = ratio != null && (ratio < 75 || ratio > 130);
                  return (
                    <tr key={i} className={c.source === "realized" ? "bg-emerald-50/60" : outlier ? "bg-amber-50" : undefined}>
                      <td className="px-6 py-2 text-gray-800">{c.label}</td>
                      <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{c.area ? `${c.area} m²` : "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{c.price ? fmtPrice(c.price) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900 tabular-nums">{fmtPerSqm(c.pricePerSqm)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                        {ratio != null ? `${ratio < 100 ? "−" : "+"}${Math.abs(100 - ratio)} %` : "—"}
                      </td>
                      <td className="px-6 py-2 text-right text-gray-500">
                        {c.source === "realized"
                          ? c.soldAt
                            ? `prodej ${new Date(c.soldAt).toLocaleDateString("cs-CZ", { month: "short", year: "numeric" })}`
                            : "realizované prodeje"
                          : "nabídka"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI korekce mikro-polohy */}
      {aiCorrection && (
        <div className="rp-card border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">AI korekce — mikro-poloha</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-2 items-baseline mb-3">
            <div>
              <p className="text-xs text-gray-500">Statistický odhad</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtPrice(v.estimate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Po AI korekci</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtPrice(aiCorrection.adjustedEstimate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Úprava</p>
              <p className={`text-lg font-bold tabular-nums ${aiCorrection.direction === "up" ? "text-emerald-700" : aiCorrection.direction === "down" ? "text-amber-700" : "text-gray-700"}`}>
                {aiCorrection.adjustmentPct > 0 ? "+" : ""}
                {aiCorrection.adjustmentPct.toLocaleString("cs-CZ")} % · {aiCorrection.adjustedPricePerSqm.toLocaleString("cs-CZ")} Kč/m²
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-700">{aiCorrection.reasoning}</p>
          {aiCorrection.factors.length > 0 && (
            <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
              {aiCorrection.factors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Jistota: {aiCorrection.confidence}. Korekce je doporučení modelu podle adresy a srovnatelných, nikoli statistický výpočet.
          </p>
        </div>
      )}

      {/* AI */}
      {ai && (
        <div className="rp-card border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">AI hodnocení</h2>
          <p className="text-sm text-gray-700">{ai.summary}</p>
          {ai.drivers.length > 0 && (
            <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
              {ai.drivers.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {ai.caveats.length > 0 && (
            <p className="text-sm text-amber-700 mt-2">{ai.caveats.join(" ")}</p>
          )}
        </div>
      )}

      {/* Metodika */}
      <div className="rp-card border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Metodika a zdroje</h2>
        </div>
        <div className="p-6">
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1.5">
            {v.methodology.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ol>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Odhad je orientační, založený na veřejných datech (ČÚZK / Seznam cenová mapa, ČSÚ, nabídky z realitních portálů).
        Nenahrazuje znalecký posudek. Vygenerováno v RealFlip.
      </p>
    </div>
  );
}
