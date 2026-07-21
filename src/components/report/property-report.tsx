"use client";

import { useMemo, useState, useEffect } from "react";
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

function fmtPrice(v: number) {
  return `${v.toLocaleString()} Kč`;
}

export default function PropertyReport({ property, analysis, priceHistory }: { property: PropertyData; analysis: AnalysisData | null; priceHistory: { price: number; recordedAt: number }[] }) {
  const area = property.area ?? 70;

  const [stored, setStored] = useState<{ arv: number; renovationCost: number; targetRoi: number; costConfig: any } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`report-config-${property.id}`);
      if (raw) setStored(JSON.parse(raw));
    } catch {}
  }, [property.id]);

  const arvValue = stored?.arv ?? analysis?.arv ?? property.price;
  const renoCost = stored?.renovationCost ?? analysis?.renovationCost ?? 500000;
  const targetRoi = stored?.targetRoi ?? 15;
  const costConfig = stored?.costConfig ?? {};
  const verdict = analysis?.verdictLevel ?? "consider";
  const score = analysis?.investmentScore ?? 0;

  // ===== ORIGINAL: calculation at listing price, no sourcing fee =====
  const originalResults = useMemo(() => {
    const base = { ...costConfig, sourcingFee: 0, sourcingEnabled: false };
    return calculateFlipResults(property.price, arvValue, renoCost, area, targetRoi, base);
  }, [property.price, arvValue, renoCost, area, targetRoi, costConfig]);

  // ===== TARGET: calculation at negotiated price with sourcing fee =====
  const targetResults = useMemo(() => {
    const targetPrice = originalResults.targetPurchasePrice;
    if (targetPrice <= 0) return null;
    const adjusted = { ...costConfig, sourcingFee: costConfig.sourcingEnabled ? costConfig.sourcingFee : 0 };
    return calculateFlipResults(targetPrice, arvValue, renoCost, area, targetRoi, adjusted);
  }, [originalResults.targetPurchasePrice, arvValue, renoCost, area, targetRoi, costConfig]);

  const t = targetResults;

  const targetAdjusted = t && {
    ...t,
    costs: { ...t.costs },
  };

  const adjustedScore = useMemo(() => {
    if (!t) return score;
    const roiPoints = Math.min(50, Math.round((t.roi / targetRoi) * 50));
    const scorePoints = Math.round(score * 0.3);
    const arvBonus = arvValue > property.price ? 20 : 0;
    return Math.min(100, Math.round(roiPoints + scorePoints + arvBonus));
  }, [t, score, targetRoi, arvValue, property.price]);

  const scoreColor = score >= 60 ? "text-emerald-700" : score >= 40 ? "text-amber-700" : "text-red-700";
  const adjustedScoreColor = adjustedScore >= 60 ? "text-emerald-700" : adjustedScore >= 40 ? "text-amber-700" : "text-red-700";

  const itemized = useMemo(() => calculateItemizedRenovation(area, property.condition), [area, property.condition]);

  const redFlags = useMemo(() => {
    try { return JSON.parse(analysis?.redFlagsJson ?? "[]") as { type: string; text: string; severity: string }[]; } catch { return []; }
  }, [analysis?.redFlagsJson]);

  function handlePrint() { window.print(); }

  const oc = originalResults.costs;

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
        <button onClick={handlePrint} className="h-10 px-6 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">Stáhnout PDF</button>
        <button onClick={handlePrint} className="h-10 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Vytisknout</button>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="rp-card border-b-2 border-gray-200 pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{property.title}</h1>
            <span className="text-2xl font-semibold font-mono tracking-tight text-gray-900">{property.price > 0 ? fmtPrice(property.price) : "—"}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{property.address || "—"}</p>
          {property.portalName === "offline" && <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-xs font-medium mt-2">Offline inzerát</span>}
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span>{property.rooms || "—"}</span>
            <span className="w-px h-3 bg-gray-300" />
            <span>{property.area} m²</span>
            <span className="w-px h-3 bg-gray-300" />
            <span>{conditionLabel(property.condition)}</span>
          </div>
        </div>

        {/* Comparison Scoring Box */}
        <div className="rp-card border border-gray-200 rounded-xl p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center border-r border-gray-200 pr-4">
              <div className="flex items-center justify-center h-20 w-20 mx-auto rounded-full bg-gray-200">
                <span className={`text-3xl font-bold font-mono ${scoreColor}`}>{score}</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 mt-3">{verdictLabels[verdict] ?? verdict}</p>
              {analysis?.verdictSummary && <p className="text-sm text-gray-600 mt-1">{analysis.verdictSummary}</p>}
            </div>
            <div className="text-center pl-4">
              <div className="flex items-center justify-center h-20 w-20 mx-auto rounded-full bg-gray-200">
                <span className={`text-3xl font-bold font-mono ${adjustedScoreColor}`}>{adjustedScore}</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 mt-3">
                {adjustedScore >= 70 ? "Silně doporučeno" : adjustedScore >= 50 ? "Doporučeno" : adjustedScore >= 30 ? "Zvážit" : "Zamítnout"}
              </p>
              {t && <p className="text-sm text-gray-600 mt-1">Cílová cena: {fmtPrice(originalResults.targetPurchasePrice)}</p>}
            </div>
          </div>
        </div>

        {/* Section: Původní inzerát */}
        <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Původní inzerát</h2>
          </div>
          <div className="p-6">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-1.5 pr-4 text-gray-600">Inzerovaná cena</td><td className="py-1.5 text-right font-mono font-medium text-gray-900">{fmtPrice(property.price)}</td></tr>
                <tr><td className="py-1.5 pr-4 text-gray-600">Cena za m²</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(area > 0 ? Math.round(property.price / area) : 0)}</td></tr>
                <tr><td className="py-1.5 pr-4 text-gray-600">ARV</td><td className="py-1.5 text-right font-mono font-medium text-gray-900">{fmtPrice(arvValue)}</td></tr>
                <tr><td className="py-1.5 pr-4 text-gray-600">Náklady na rekonstrukci</td><td className="py-1.5 text-right font-mono font-medium text-gray-700">{fmtPrice(renoCost)}</td></tr>
                <tr><td className="py-1.5 pr-4 text-gray-600">Celkové náklady</td><td className="py-1.5 text-right font-mono font-medium text-gray-700">{fmtPrice(oc.totalCost)}</td></tr>
                <tr><td className="py-1.5 pr-4 text-gray-600">Očekávaný zisk</td><td className={`py-1.5 text-right font-mono font-medium ${originalResults.netProfit > 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtPrice(originalResults.netProfit)}</td></tr>
                <tr><td className="py-1.5 pr-4 text-gray-600">ROI</td><td className={`py-1.5 text-right font-mono font-medium ${originalResults.roi > 0 ? "text-emerald-700" : "text-red-700"}`}>{originalResults.roi} %</td></tr>
                <tr><td className="py-1.5 pr-4 text-gray-600">Skóre</td><td className="py-1.5 text-right font-mono font-semibold text-gray-900">{score}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section: Po vyjednání */}
        {t && (
          <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-200">
              <h2 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Po vyjednání</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-gray-500">Cílová kupní cena</span>
                <span className="font-semibold font-mono text-gray-900">{fmtPrice(originalResults.targetPurchasePrice)}</span>
              </div>
              {originalResults.priceReductionPct > 0 && (
                <div className="flex items-center justify-between mb-4 text-sm">
                  <span className="text-gray-500">Snížení o {originalResults.priceReductionPct} %</span>
                  <span className="font-mono text-emerald-700">-{fmtPrice(originalResults.priceReductionNeeded)}</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-gray-500">Cena za m² při cílové ceně</span>
                <span className="font-mono text-gray-700">{fmtPrice(area > 0 ? Math.round(originalResults.targetPurchasePrice / area) : 0)}</span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-1 pr-4 text-gray-600">Kupní cena</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(originalResults.targetPurchasePrice)}</td></tr>
                  {t.costs.legalFees > 0 && <tr><td className="py-1 pr-4 text-gray-600">Právní služby</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.legalFees)}</td></tr>}
                  {t.costs.appraisalFee > 0 && <tr><td className="py-1 pr-4 text-gray-600">Znalecký posudek</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.appraisalFee)}</td></tr>}
                  <tr><td className="py-1 pr-4 text-gray-600">Rekonstrukce</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.renovationCost)}</td></tr>
                  <tr><td className="py-1 pr-4 text-gray-600">Rezerva 10 %</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.contingency)}</td></tr>
                  {t.costs.sellingCommission > 0 && <tr><td className="py-1 pr-4 text-gray-600">Provize RK prodejní (4 %)</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.sellingCommission)}</td></tr>}
                  {t.costs.marketingPhoto > 0 && <tr><td className="py-1 pr-4 text-gray-600">Marketing + foto</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.marketingPhoto)}</td></tr>}
                  <tr><td className="py-1 pr-4 text-gray-600">Provozní náklady (6 měsíců)</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.holdingCosts)}</td></tr>
                  {t.costs.sourcingFee > 0 && <tr><td className="py-1 pr-4 text-gray-600">Sourcing fee</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.sourcingFee)}</td></tr>}
                  {t.costs.mortgageCost > 0 && <tr><td className="py-1 pr-4 text-gray-600">Náklady na hypotéku</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.mortgageCost)}</td></tr>}
                  <tr><td className="py-1 pr-4 text-gray-600">Daň z příjmu (15 %)</td><td className="py-1 text-right font-mono text-gray-700">{fmtPrice(t.costs.incomeTax)}</td></tr>
                </tbody>
              </table>
              <div className="border-t border-gray-300 mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-900">Náklady celkem</span>
                  <span className="font-mono font-semibold text-gray-900">{fmtPrice(t.costs.totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">ARV</span>
                  <span className="font-mono font-semibold text-gray-900">{fmtPrice(arvValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 text-xs pl-2">ARV/m²</span>
                  <span className="font-mono text-xs text-gray-600">{fmtPrice(area > 0 ? Math.round(arvValue / area) : 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Zisk</span>
                  <span className={`font-mono font-semibold ${t.netProfit > 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtPrice(t.netProfit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">ROI</span>
                  <span className={`font-mono font-semibold ${t.roi >= targetRoi ? "text-emerald-700" : "text-gray-700"}`}>{t.roi} %</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600">Nové skóre</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold font-mono ${
                    adjustedScore >= 60 ? "bg-emerald-50 text-emerald-700" : adjustedScore >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                  }`}>{adjustedScore}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!t && (
          <div className="rp-card border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
            Cílová cena je nižší než 0 – výpočet není možný.
          </div>
        )}

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
