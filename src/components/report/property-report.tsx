"use client";

import { useMemo } from "react";
import { calculateFlipResults, calculateItemizedRenovation } from "@/lib/analysis/flip-costs";
import { conditionLabel } from "@/lib/utils";

interface PropertyData {
  id: string;
  title: string;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  rooms: string | null;
  floor: number | null;
  condition: string | null;
  buildingType: string | null;
  yearBuilt: number | null;
  address: string | null;
  description: string | null;
  imageUrls: string;
  url: string;
  portalName: string;
  firstSeen: number;
}

interface AnalysisData {
  id: string;
  investmentScore: number | null;
  arv: number | null;
  renovationCost: number | null;
  totalCost: number | null;
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  cashOnCash: number | null;
  breakEvenPrice: number | null;
  recommendation: string | null;
  undervaluationPct: number | null;
  overpricingPct: number | null;
  marketPriceMin: number | null;
  marketPriceMax: number | null;
  verdictLevel: string | null;
  verdictSummary: string | null;
  redFlagsJson: string | null;
  costsJson: string | null;
  locationCity: string | null;
  rentalYield: number | null;
}

const verdictLabels: Record<string, string> = {
  strongBuy: "Silně doporučeno",
  buy: "Doporučeno",
  consider: "Zvážit",
  dontBuy: "Nedoporučeno",
  categoricalReject: "Zamítnout",
};

function fmt(v: number) {
  return `${(v / 1000000).toFixed(1)} mil. Kč`;
}

function fmtPrice(v: number) {
  return `${v.toLocaleString()} Kč`;
}

export default function PropertyReport({ property, analysis, priceHistory }: { property: PropertyData; analysis: AnalysisData | null; priceHistory: { price: number; recordedAt: number }[] }) {
  const area = property.area ?? 70;
  const arvValue = analysis?.arv ?? property.price;
  const renoCost = analysis?.renovationCost ?? 500000;
  const verdict = analysis?.verdictLevel ?? "consider";

  const flipResults = useMemo(() => {
    return calculateFlipResults(property.price, arvValue, renoCost, area, 15);
  }, [property.price, arvValue, renoCost, area]);

  const itemized = useMemo(() => {
    return calculateItemizedRenovation(area, property.condition);
  }, [area, property.condition]);

  const redFlags = useMemo(() => {
    try { return JSON.parse(analysis?.redFlagsJson ?? "[]") as { type: string; text: string; severity: string }[]; } catch { return []; }
  }, [analysis?.redFlagsJson]);

  const costs = flipResults.costs;
  const score = analysis?.investmentScore ?? 0;
  const lowContrast = score >= 60 ? "text-emerald-700" : score >= 40 ? "text-amber-700" : "text-red-700";

  function handlePrint() {
    window.print();
  }

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

      <div className="no-print flex items-center justify-center gap-4 mb-8">
        <button onClick={handlePrint} className="h-10 px-6 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
          Stáhnout PDF
        </button>
        <button onClick={handlePrint} className="h-10 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
          Vytisknout
        </button>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="rp-card border-b-2 border-gray-200 pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{property.title}</h1>
            <span className="text-2xl font-semibold font-mono tracking-tight">{fmt(property.price)}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{property.address || "—"}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span>{property.rooms || "—"}</span>
            <span className="w-px h-3 bg-gray-300" />
            <span>{property.area} m²</span>
            <span className="w-px h-3 bg-gray-300" />
            <span>{conditionLabel(property.condition)}</span>
          </div>
        </div>

        {/* Score + Verdict */}
        <div className="rp-card flex items-center gap-6 bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gray-200">
            <span className={`text-3xl font-bold font-mono ${lowContrast}`}>{score}</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{verdictLabels[verdict] ?? verdict}</p>
            {analysis?.verdictSummary && <p className="text-sm text-gray-600 mt-0.5">{analysis.verdictSummary}</p>}
          </div>
          <div className="ml-auto text-right">
            {analysis?.undervaluationPct != null && analysis.undervaluationPct > 0 && (
              <p className="text-sm font-semibold text-emerald-700">Podhodnoceno o {analysis.undervaluationPct} %</p>
            )}
            {analysis?.rentalYield && <p className="text-xs text-gray-500 mt-0.5">Výnos: {analysis.rentalYield} %</p>}
          </div>
        </div>

        {/* Financial Overview */}
        <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Finanční přehled</h2>
          </div>
          <div className="p-6">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: "Kupní cena", value: fmtPrice(property.price) },
                  { label: "ARV (odhad po rekonstrukci)", value: fmtPrice(arvValue), accent: true },
                  { label: "Náklady na rekonstrukci", value: fmtPrice(renoCost) },
                  { label: "Celkové náklady", value: fmtPrice(costs.totalCost) },
                  { label: "Očekávaný zisk", value: fmtPrice(flipResults.netProfit), highlight: flipResults.netProfit > 0 },
                  { label: "ROI", value: `${flipResults.roi} %`, highlight: flipResults.roi > 0 },
                  { label: "Annualizované ROI", value: `${flipResults.annualizedRoi} %` },
                  { label: "Cílová kupní cena", value: fmtPrice(flipResults.targetPurchasePrice) },
                  { label: "Nutné snížení ceny", value: `${flipResults.priceReductionPct} %` },
                ].map((r) => (
                  <tr key={r.label}>
                    <td className="py-1.5 pr-4 text-gray-600">{r.label}</td>
                    <td className={`py-1.5 text-right font-mono font-medium ${r.highlight ? "text-emerald-700" : r.accent ? "text-gray-900" : "text-gray-700"}`}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Detail nákladů</h2>
          </div>
          <div className="p-6">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: "Kupní cena", value: costs.purchasePrice },
                  { label: "Provize makléře", value: costs.sellingCommission },
                  { label: "Právní služby", value: costs.legalFees },
                  { label: "Znalecký posudek", value: costs.appraisalFee },
                  { label: "Provozní náklady", value: costs.holdingCosts },
                  { label: "Náklady na rekonstrukci", value: costs.renovationCost },
                  { label: "Rezerva (10 %)", value: costs.contingency },
                  { label: "Marketing + foto", value: costs.marketingPhoto },
                  { label: "Provize za zprostředkování", value: costs.sourcingFee },
                  { label: "Náklady na hypotéku", value: costs.mortgageCost },
                  { label: "Daň z příjmu", value: costs.incomeTax },
                ].filter((r) => r.value > 0).map((r) => (
                  <tr key={r.label}>
                    <td className="py-1 pr-4 text-gray-600">{r.label}</td>
                    <td className="py-1 text-right font-mono text-gray-700">{fmtPrice(r.value)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300">
                  <td className="py-2 pr-4 font-semibold text-gray-900">Celkem</td>
                  <td className="py-2 text-right font-mono font-semibold text-gray-900">{fmtPrice(costs.totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Renovation items */}
        {itemized.length > 0 && (
          <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Položky rekonstrukce</h2>
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {itemized.map((item) => (
                    <tr key={item.category}>
                      <td className="py-1 pr-4 text-gray-600">{item.category}</td>
                      <td className="py-1 text-right font-mono text-gray-700">{fmtPrice(item.estimatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Red Flags */}
        {redFlags.length > 0 && (
          <div className="rp-card border border-red-200 rounded-xl p-6 bg-red-50">
            <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">Varovné signály</h2>
            <ul className="space-y-1">
              {redFlags.map((rf, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{rf.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Description */}
        {property.description && (
          <div className="rp-card border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Popis nemovitosti</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 text-center">
          <p className="text-xs text-gray-400">
            Vygenerováno prostřednictvím investorské aplikace RealFlip – {new Date().toLocaleDateString("cs-CZ")}
          </p>
        </div>
      </div>
    </div>
  );
}
