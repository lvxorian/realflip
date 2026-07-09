import Link from "next/link";
import { db } from "@/db";
import { deals, properties, propertyAnalysis } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import {
  ArrowRight, CurrencyDollar, Folder, CheckCircle,
} from "@phosphor-icons/react/dist/ssr";

function fmt(p: number) { return `${(p / 1000000).toFixed(1)} mil. Kč`; }

export default async function PortfolioPage() {
  const allDeals = await db
    .select()
    .from(deals)
    .leftJoin(properties, eq(deals.propertyId, properties.id))
    .leftJoin(propertyAnalysis, eq(deals.propertyId, propertyAnalysis.propertyId));

  const activeDeals = allDeals.filter((d) => d.deals.status !== "sold");
  const completedDeals = allDeals.filter((d) => d.deals.status === "sold");

  const totalProfit = completedDeals.reduce((s, d) => {
    const sell = d.deals.sellPrice ?? 0;
    const purchase = d.deals.purchasePrice ?? 0;
    const reno = d.deals.renovationActual ?? d.deals.renovationBudget ?? 0;
    return s + (sell - purchase - reno);
  }, 0);

  const totalRoi = completedDeals.length > 0
    ? completedDeals.reduce((s, d) => {
        const sell = d.deals.sellPrice ?? 0;
        const purchase = d.deals.purchasePrice ?? 0;
        const cost = purchase + (d.deals.renovationActual ?? d.deals.renovationBudget ?? 0);
        return s + (cost > 0 ? ((sell - cost) / cost) * 100 : 0);
      }, 0) / completedDeals.length
    : 0;

  const activeProfit = activeDeals.reduce((s, d) => {
    const arv = d.property_analysis?.arv ?? 0;
    const purchase = d.deals.purchasePrice ?? 0;
    const reno = d.deals.renovationBudget ?? 0;
    return s + (arv - purchase - reno);
  }, 0);

  const portfolioStats = [
    { label: "Aktivní projekty", value: activeDeals.length, suffix: "", icon: Folder },
    { label: "Očekávaný zisk", value: activeProfit, suffix: "", icon: CurrencyDollar, format: true },
    { label: "Prům. ROI", value: Math.round(totalRoi * 10) / 10, suffix: "%", decimals: 1, icon: Folder },
    { label: "Dokončené", value: completedDeals.length, suffix: "", icon: CheckCircle },
  ];

  const statusLabel: Record<string, string> = {
    purchased: "Koupeno", renovating: "Rekonstrukce", selling: "Na prodej", sold: "Prodáno",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted mt-1">Přehled vašich investičních projektů</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {portfolioStats.map((s, i) => (
          <div key={s.label} className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted">{s.label}</span>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <s.icon size={16} weight="duotone" />
              </div>
            </div>
            <div className="text-2xl font-semibold font-mono">
              {s.format ? `${(s.value / 1000000).toFixed(1)}M` : s.value}{s.suffix}
            </div>
          </div>
        ))}
      </div>

      {activeDeals.length > 0 && (
        <div>
          <h2 className="font-semibold tracking-tight mb-4">Aktivní projekty ({activeDeals.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeDeals.map((d) => {
              const title = d.properties?.title ?? "Neznámý projekt";
              const arv = d.property_analysis?.arv ?? 0;
              const budget = d.deals.renovationBudget ?? 0;
              const totalCost = (d.deals.purchasePrice ?? 0) + budget;
              const progress = budget > 0 && d.deals.renovationActual
                ? Math.round((d.deals.renovationActual / budget) * 100) : 0;
              const score = d.property_analysis?.investmentScore ?? 0;
              return (
                <Link key={d.deals.id} href={`/portfolio/${d.deals.id}`}>
                  <div className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover hover:border-accent/20 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold tracking-tight text-sm group-hover:text-accent transition-colors truncate">{title}</h3>
                        <p className="text-xs text-muted mt-0.5">{fmt(d.deals.purchasePrice)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <ScoreGauge score={score} size={36} strokeWidth={2.5} />
                        <ArrowRight size={16} className="text-muted group-hover:text-accent transition-colors" weight="bold" />
                      </div>
                    </div>
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-xs">
                        <Badge variant={d.deals.status === "renovating" ? "warning" : "info"} size="sm">
                          {statusLabel[d.deals.status] ?? d.deals.status}
                        </Badge>
                        <span className="font-mono">{progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>ARV: {arv > 0 ? fmt(arv) : "—"}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-border" />
                      <span>Reko: {budget.toLocaleString()} Kč</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {completedDeals.length > 0 && (
        <div>
          <h2 className="font-semibold tracking-tight mb-4">Dokončené obchody ({completedDeals.length})</h2>
          <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/20 overflow-hidden">
            {completedDeals.map((d) => {
              const title = d.properties?.title ?? "Neznámý";
              const purchase = d.deals.purchasePrice ?? 0;
              const sell = d.deals.sellPrice ?? 0;
              const reno = d.deals.renovationActual ?? d.deals.renovationBudget ?? 0;
              const profit = sell - purchase - reno;
              const roi = purchase > 0 ? ((sell - purchase - reno) / (purchase + reno)) * 100 : 0;
              return (
                <div key={d.deals.id} className="flex items-center justify-between p-4 hover:bg-card-hover transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                      <CheckCircle size={16} weight="fill" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{title}</p>
                      <p className="text-xs text-muted">{statusLabel[d.deals.status] ?? d.deals.status}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold font-mono ${profit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {profit > 0 ? "+" : ""}{(profit / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-muted font-mono">{roi > 0 ? "+" : ""}{roi.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allDeals.length === 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
          <p className="text-muted text-sm">Zatím nemáte žádné projekty. Začněte scrapováním inzerátů.</p>
        </div>
      )}
    </div>
  );
}
