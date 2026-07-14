import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { deals, properties, propertyAnalysis, dealExpenses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { safeJsonParse } from "@/lib/utils";
import { CheckCircle, Clock, ArrowLeft, MapPin, CurrencyDollar } from "@phosphor-icons/react/dist/ssr";

const statusLabel: Record<string, string> = { purchased: "Koupeno", renovating: "Rekonstrukce", selling: "Na prodej", sold: "Prodáno" };
const statusColor: Record<string, "info" | "warning" | "success"> = { purchased: "info", renovating: "warning", selling: "info", sold: "success" };

export default async function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, id))
    .leftJoin(properties, eq(deals.propertyId, properties.id))
    .leftJoin(propertyAnalysis, eq(deals.propertyId, propertyAnalysis.propertyId))
    .limit(1)
    .then((r) => r[0]);

  if (!deal) notFound();

  const expenses = await db
    .select()
    .from(dealExpenses)
    .where(eq(dealExpenses.dealId, id))
    .orderBy(desc(dealExpenses.date));

  const d = deal.deals;
  const prop = deal.properties;
  const analysis = deal.property_analysis;

  const renovationItems: Array<{ category: string; planned: number; actual: number | null; notes: string | null }> = safeJsonParse<Array<{ category: string; planned: number; actual: number | null; notes: string | null }>>(d.renovationItems, []);

  const totalPlanned = renovationItems.reduce((s, i) => s + i.planned, 0);
  const totalActual = renovationItems.reduce((s, i) => s + (i.actual || 0), 0);
  const remaining = totalPlanned - totalActual;
  const progress = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  const expectedProfit = (analysis?.arv ?? d.sellPrice ?? 0) - (d.purchasePrice ?? 0) - (d.renovationActual ?? d.renovationBudget ?? 0);

  return (
    <div className="space-y-6">
      <Link href="/portfolio" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
        <ArrowLeft size={14} weight="bold" />
        Zpět na portfolio
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[2.5rem] border border-border/50 bg-card overflow-hidden">
            <div className="relative h-48 property-image-shimmer flex items-center justify-center">
              <ScoreGauge score={analysis?.investmentScore ?? 50} size={48} strokeWidth={3.5} />
              <Badge variant={statusColor[d.status]} size="md" className="absolute top-4 right-4">
                {statusLabel[d.status] ?? d.status}
              </Badge>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{prop?.title ?? "Projekt"}</h1>
                  {prop?.address && (
                    <div className="flex items-center gap-1 text-sm text-muted mt-1">
                      <MapPin size={14} weight="bold" />
                      {prop.address}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 py-4 mb-4">
                {[
                  { label: "Koupeno", date: new Date(d.purchaseDate).toLocaleDateString("cs-CZ"), done: true },
                  { label: "Rekonstrukce", date: d.status === "purchased" ? "Zbývá" : "Probíhá", done: d.status !== "purchased" },
                  { label: "Prodej", date: d.status === "sold" ? new Date(d.sellDate!).toLocaleDateString("cs-CZ") : "Čeká", done: d.status === "sold" },
                ].map((phase, i) => (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                      phase.done ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-card text-muted border-border/50"
                    }`}>
                      {phase.done ? <CheckCircle size={16} weight="fill" /> : <Clock size={16} weight="fill" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{phase.label}</p>
                      <p className="text-[10px] text-muted">{phase.date}</p>
                    </div>
                    {i < 2 && <div className="flex-1 h-px bg-border/50 mx-1" />}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-xs text-muted">Kupní cena</p>
                  <p className="text-lg font-semibold font-mono">{(d.purchasePrice / 1000000).toFixed(1)} mil.</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-xs text-muted">ARV</p>
                  <p className="text-lg font-semibold font-mono text-accent">
                    {((analysis?.arv ?? d.sellPrice ?? 0) / 1000000).toFixed(1)} mil.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-xs text-muted">Očekávaný zisk</p>
                  <p className={`text-lg font-semibold font-mono ${expectedProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(expectedProfit / 1000000).toFixed(1)} mil.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted">Celkový průběh</span>
                  <span className="font-semibold font-mono">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-border/30 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Budget */}
          {renovationItems.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold tracking-tight text-sm">Rozpočet rekonstrukce</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400 font-mono">{progress}%</span>
                  <Badge variant="warning" size="sm">{remaining.toLocaleString()} Kč zbývá</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {renovationItems.map((item, i) => {
                  const pct = item.actual ? (item.actual / item.planned) * 100 : 0;
                  return (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.category}</span>
                          {item.notes && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-border/30 text-muted">{item.notes}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-muted">{item.planned.toLocaleString()} Kč</span>
                          <span className={item.actual && item.actual <= item.planned ? "text-emerald-400" : "text-red-400"}>
                            {item.actual ? `${item.actual.toLocaleString()} Kč` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                        <div className={`h-full rounded-full ${pct <= 100 ? "bg-accent" : "bg-red-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expenses */}
          {expenses.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="font-semibold tracking-tight text-sm mb-4">Výdaje ({expenses.length})</h2>
              <div className="space-y-2 text-sm">
                {expenses.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/[0.02]">
                    <div>
                      <p className="font-medium">{e.category}</p>
                      {e.description && <p className="text-xs text-muted">{e.description}</p>}
                    </div>
                    <span className="font-mono">{e.amount.toLocaleString()} Kč</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h2 className="font-semibold tracking-tight text-sm mb-4">Finance</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Nákup</span>
                <span className="font-mono font-medium">{(d.purchasePrice / 1000000).toFixed(1)} mil.</span>
              </div>
              {d.renovationBudget && (
                <div className="flex justify-between">
                  <span className="text-muted">Rekonstrukce (plán)</span>
                  <span className="font-mono font-medium">{(d.renovationBudget / 1000000).toFixed(1)} mil.</span>
                </div>
              )}
              {d.renovationActual && (
                <div className="flex justify-between">
                  <span className="text-muted">Rekonstrukce (aktuál)</span>
                  <span className="font-mono font-medium">{(d.renovationActual / 1000000).toFixed(1)} mil.</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">{d.status === "sold" ? "Prodejní cena" : "ARV"}</span>
                <span className="font-mono font-medium text-accent">
                  {((analysis?.arv ?? d.sellPrice ?? 0) / 1000000).toFixed(1)} mil.
                </span>
              </div>
              <div className="border-t border-border/30 pt-2 flex justify-between font-semibold">
                <span>Očekávaný zisk</span>
                <span className={`font-mono ${expectedProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(expectedProfit / 1000000).toFixed(1)} mil.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
