export const dynamic = "force-dynamic";

import { ArrowUp, ArrowDown, ChartBar } from "@phosphor-icons/react/dist/ssr";
import { LocalityMarkets } from "@/components/market/locality-markets";
import { BuyVsRentCalculator } from "@/components/market/buy-vs-rent";
import { PriceIndexCard } from "@/components/market/price-index-card";
import { getMarketSummary } from "@/lib/market/market-summary";

function fmtPrice(v: number) { return `${(v / 1000).toFixed(0)}k`; }

function trendIcon(change: number) { return change >= 0 ? ArrowUp : ArrowDown; }

export default async function MarketPage() {
  const summary = await getMarketSummary();

  if (summary.totalListings === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trh</h1>
          <p className="text-sm text-muted mt-1">Zatím žádná data – spusťte scraping pro sběr inzerátů</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
          <ChartBar size={40} className="mx-auto text-muted mb-4" weight="duotone" />
          <p className="text-muted">Jakmile naskrabeme první inzeráty, zobrazí se zde tržní přehled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trh</h1>
        <p className="text-sm text-muted mt-1">Přehled realitního trhu z nasbíraných dat ({summary.totalListings} inzerátů)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Aktivních inzerátů", value: summary.activeListings.toString(), sub: `z ${summary.totalListings} celkem` },
          { label: "Ø cena/m²", value: fmtPrice(summary.avgPricePerSqm), sub: `${summary.trendPct >= 0 ? "+" : ""}${summary.trendPct.toFixed(1)}% trend`, icon: trendIcon(summary.trendPct) },
          { label: "Ø dny na trhu", value: summary.avgDays.toString(), sub: "dní" },
          { label: "Potenciální dropy", value: `${Math.round((summary.priceDrops / Math.max(summary.activeListings, 1)) * 100)}%`, sub: "inzerátů 14+ dní" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted">{s.label}</span>
              {s.icon ? <s.icon size={16} className="text-muted" weight="duotone" /> : <ChartBar size={16} className="text-muted" weight="duotone" />}
            </div>
            <p className="text-xl font-semibold font-mono tracking-tight">{s.value}</p>
            <p className="text-xs text-muted mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-semibold tracking-tight mb-4">Ceny v lokalitách (z nasbíraných dat)</h2>
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-4 text-xs text-muted font-medium">Lokalita</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Ø cena/m²</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Inzerátů</th>
                  <th className="text-right p-4 text-xs text-muted font-medium hidden sm:table-cell">Ø dny na trhu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {summary.cityRows.map((loc) => (
                  <tr key={loc.name} className="hover:bg-card-hover transition-colors">
                    <td className="p-4 font-medium capitalize">{loc.name}</td>
                    <td className="p-4 text-right font-mono">
                      {new Intl.NumberFormat("cs-CZ", { style: "decimal", maximumFractionDigits: 0 }).format(loc.price)} Kč
                    </td>
                    <td className="p-4 text-right font-mono">{loc.listings}</td>
                    <td className="p-4 text-right font-mono text-muted hidden sm:table-cell">{loc.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <LocalityMarkets cities={summary.cityKeys} />

      <PriceIndexCard />

      <BuyVsRentCalculator />

      <div>
        <h2 className="font-semibold tracking-tight mb-4">Top lokality podle skóre</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summary.topByScore.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/50 bg-card p-5">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted capitalize mt-0.5">{p.city}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted">Skóre</span>
                <span className={`font-mono font-semibold text-lg ${p.score >= 60 ? "text-emerald-400" : p.score >= 40 ? "text-amber-400" : "text-red-400"}`}>
                  {p.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
