"use client";

import { useState } from "react";
import { OwnerReportContent } from "@/components/auctions/owner-report";
import { ChartLine, House } from "@phosphor-icons/react";

export interface AuctionReportCosts {
  contingency: number;
  sellingCommission: number;
  marketingPhoto: number;
  holdingCosts: number;
  sourcingFee: number;
  incomeTax: number;
  totalCost: number;
}

export interface AuctionReportData {
  title: string;
  address: string | null;
  caseNumber: string | null;
  auctionDate: string | null;
  oc: number;
  np: number;
  asIsTmv: number;
  td: number;
  tc: number;
  discount: number;
  renovationCost: number;
  arv: number;
  holdingMonths: number;
  sellCommission: boolean;
  sourcingEnabled: boolean;
  sourcingFee: number;
  sourcingFeeIsPct: boolean;
  targetRoi: number;
  strategy: "sourcing-fee" | "fifty-fifty";
  tbp: number;
  nco: number;
  feasible: boolean;
  auctionPayout: number;
  negotiationAdvantage: number;
  ceilingPrice: number;
  breakEvenPrice: number;
  netProfit: number;
  roi: number;
  annualizedRoi: number;
  cashOnCash: number;
  investorProfit: number;
  dealmakerProfit: number;
  costs: AuctionReportCosts;
}

function fmtPrice(v: number) {
  return `${v.toLocaleString("cs-CZ")} Kč`;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AuctionReport({
  data,
  initialType = "investor",
}: {
  data: AuctionReportData;
  initialType?: "investor" | "owner";
}) {
  const [type, setType] = useState<"investor" | "owner">(initialType);
  const strategyLabel = data.strategy === "fifty-fifty" ? "50/50" : "Sourcing fee";

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

      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-center gap-3 mb-8">
        <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            onClick={() => setType("investor")}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium transition-colors ${
              type === "investor" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-200/60"
            }`}
          >
            <ChartLine size={14} weight="bold" />
            Investor
          </button>
          <button
            onClick={() => setType("owner")}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium transition-colors ${
              type === "owner" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-200/60"
            }`}
          >
            <House size={14} weight="bold" />
            Majitel
          </button>
        </div>
        <button onClick={handlePrint} className="h-10 px-6 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
          Stáhnout PDF
        </button>
        <button onClick={handlePrint} className="h-10 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
          Vytisknout
        </button>
      </div>

      {type === "investor" ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="rp-card border-b-2 border-gray-200 pb-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Investiční analýza – Výkup před dražbou</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">{data.title}</p>
            {data.address && <p className="text-sm text-gray-500">{data.address}</p>}
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
              {data.caseNumber && <span className="font-mono">{data.caseNumber}</span>}
              {data.auctionDate && <><span className="w-px h-3 bg-gray-300" /><span>Termín: {fmtDate(data.auctionDate)}</span></>}
            </div>
          </div>

          {/* Vstupní údaje */}
          <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Vstupní údaje</h2>
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-1.5 pr-4 text-gray-600">OC – odhadní cena</td><td className="py-1.5 text-right font-mono font-medium text-gray-900">{fmtPrice(data.oc)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">NP – nejnižší podání</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.np)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">AsIs TMV (100 % trhu)</td><td className="py-1.5 text-right font-mono font-medium text-gray-900">{fmtPrice(data.asIsTmv)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">TD – celkové dluhy</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.td)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">TC – náklady na akvizici</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.tc)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">Cílová sleva</td><td className="py-1.5 text-right font-mono text-gray-700">{data.discount} %</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">Rekonstrukce</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.renovationCost)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">ARV</td><td className="py-1.5 text-right font-mono font-medium text-gray-900">{fmtPrice(data.arv)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">Model</td><td className="py-1.5 text-right font-mono text-gray-700">{strategyLabel}</td></tr>
                  {data.sourcingEnabled && <tr><td className="py-1.5 pr-4 text-gray-600">Sourcing fee</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.costs.sourcingFee)}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Výkup před dražbou */}
          <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-200">
              <h2 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Výkup před dražbou</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">TBP – ideální výkupní cena ({100 - data.discount} % trhu)</span>
                <span className="font-semibold font-mono text-gray-900">{fmtPrice(data.tbp)}</span>
              </div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">NCO – zůstane dlužníkovi na ruku</span>
                <span className={`font-semibold font-mono ${data.feasible ? "text-emerald-700" : "text-red-700"}`}>{fmtPrice(data.nco)}</span>
              </div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">V dražbě by dlužník dostal (NP − dluhy)</span>
                <span className="font-mono text-gray-700">{fmtPrice(Math.max(0, data.auctionPayout))}</span>
              </div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">Výhoda dlužníka oproti dražbě</span>
                <span className={`font-mono font-medium ${data.negotiationAdvantage > 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {data.negotiationAdvantage > 0 ? "+" : ""}{fmtPrice(data.negotiationAdvantage)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">Strop (cílové ROI {data.targetRoi} %)</span>
                <span className="font-mono text-gray-700">{fmtPrice(data.ceilingPrice)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Break-even</span>
                <span className="font-mono text-gray-700">{fmtPrice(data.breakEvenPrice)}</span>
              </div>
            </div>
          </div>

          {/* Nákladová struktura */}
          <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Nákladová struktura při výkupní ceně {fmtPrice(data.tbp)}</h2>
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-1.5 pr-4 text-gray-600">Výkupní cena (TBP)</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.tbp)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">Dluhy (TD)</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.td)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">Náklady na akvizici (TC)</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.tc)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">Rekonstrukce</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.renovationCost)}</td></tr>
                  <tr><td className="py-1.5 pr-4 text-gray-600">Rezerva 10 %</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.costs.contingency)}</td></tr>
                  {data.sellCommission
                    ? <tr><td className="py-1.5 pr-4 text-gray-600">Provize RK prodejní (5 %)</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.costs.sellingCommission)}</td></tr>
                    : data.costs.marketingPhoto > 0
                      ? <tr><td className="py-1.5 pr-4 text-gray-600">Marketing + foto</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.costs.marketingPhoto)}</td></tr>
                      : null}
                  <tr><td className="py-1.5 pr-4 text-gray-600">Provozní náklady ({data.holdingMonths} měs.)</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.costs.holdingCosts)}</td></tr>
                  {data.sourcingEnabled && data.costs.sourcingFee > 0
                    ? <tr><td className="py-1.5 pr-4 text-gray-600">Sourcing fee</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.costs.sourcingFee)}</td></tr>
                    : null}
                  <tr><td className="py-1.5 pr-4 text-gray-600">Daň z příjmu (21 %)</td><td className="py-1.5 text-right font-mono text-gray-700">{fmtPrice(data.costs.incomeTax)}</td></tr>
                  <tr className="border-t-2 border-gray-200"><td className="py-2 pr-4 font-semibold text-gray-900">Náklady celkem</td><td className="py-2 text-right font-mono font-semibold text-gray-900">{fmtPrice(data.costs.totalCost)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Výsledky */}
          <div className="rp-card border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Výsledky ({strategyLabel})</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">Čistý zisk investora</span>
                <span className={`font-semibold font-mono text-gray-900 ${data.investorProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtPrice(data.investorProfit)}</span>
              </div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">Zisk dealmakera</span>
                <span className="font-mono text-gray-700">{fmtPrice(data.dealmakerProfit)}</span>
              </div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">ROI</span>
                <span className="font-mono text-gray-900">{data.roi.toFixed(1)} %</span>
              </div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-500">Roční ROI</span>
                <span className="font-mono text-gray-900">{data.annualizedRoi.toFixed(1)} %</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Cash-on-cash</span>
                <span className="font-mono text-gray-900">{data.cashOnCash.toFixed(1)} %</span>
              </div>
            </div>
          </div>

          {/* Verdikt */}
          <div className={`rp-card border-2 rounded-xl p-5 ${data.feasible ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
            <p className={`text-sm font-semibold ${data.feasible ? "text-emerald-800" : "text-red-800"}`}>
              {data.feasible
                ? `Verdikt: Výkup je realizovatelný. Majiteli zbyde na ruku ${fmtPrice(data.nco)}.`
                : "Verdikt: Riziko – dluhy přesahují nabídkovou cenu. Nutno vyjednat slevu s věřiteli (haircut)."}
            </p>
          </div>
        </div>
      ) : (
        <OwnerReportContent
          data={{
            title: data.title,
            address: data.address,
            caseNumber: data.caseNumber,
            auctionDate: data.auctionDate,
            oc: data.oc,
            np: data.np,
            td: data.td,
            tc: data.tc,
            asIsTmv: data.asIsTmv,
            tbp: data.tbp,
            nco: data.nco,
            auctionPayout: data.auctionPayout,
            negotiationAdvantage: data.negotiationAdvantage,
          }}
        />
      )}
    </div>
  );
}
