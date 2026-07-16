export const dynamic = "force-dynamic";

import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock, SealCheck } from "@phosphor-icons/react/dist/ssr";

function fmtPrice(v: number) { return `${(v / 1000).toFixed(0)}k`; }

function trendClass(change: number) { return change >= 0 ? "text-emerald-400" : "text-red-400"; }
function trendIcon(change: number) { return change >= 0 ? ArrowUp : ArrowDown; }

export default async function MarketPage() {
  const props = await db
    .select()
    .from(properties)
    .leftJoin(propertyAnalysis, eq(properties.id, propertyAnalysis.propertyId))
    .orderBy(desc(properties.lastSeen));

  const totalListings = props.length;
  const activeListings = props.filter((p) => p.properties.isActive);
  const avgPricePerSqm = activeListings.length > 0
    ? Math.round(activeListings.reduce((s, p) => s + ((p.properties.price / (p.properties.area ?? 70)) || 0), 0) / activeListings.length)
    : 0;
  const avgDays = activeListings.length > 0
    ? Math.round(activeListings.reduce((s, p) => s + Math.floor((Date.now() - new Date(p.properties.firstSeen).getTime()) / 86400000), 0) / activeListings.length)
    : 0;

  // Group by city
  const byCity: Record<string, { priceSqm: number[]; days: number[]; count: number }> = {};
  for (const p of activeListings) {
    const city = p.property_analysis?.locationCity ?? "Neznámá";
    if (!byCity[city]) byCity[city] = { priceSqm: [], days: [], count: 0 };
    if (p.properties.area && p.properties.area > 0) {
      byCity[city].priceSqm.push(Math.round(p.properties.price / p.properties.area));
    }
    byCity[city].days.push(Math.floor((Date.now() - new Date(p.properties.firstSeen).getTime()) / 86400000));
    byCity[city].count++;
  }

  const cityRows = Object.entries(byCity)
    .map(([name, data]) => ({
      name: name === "Neznámá" ? "Neznámá" : name.replace(/_/g, " "),
      price: data.priceSqm.length > 0 ? Math.round(data.priceSqm.reduce((a, b) => a + b, 0) / data.priceSqm.length) : 0,
      listings: data.count,
      days: Math.round(data.days.reduce((a, b) => a + b, 0) / data.days.length),
    }))
    .sort((a, b) => b.price - a.price);

  // Price trend (last 7 vs prior 7 days)
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86400000);
  const twoWeeksAgo = new Date(now - 14 * 86400000);
  const recentProps = activeListings.filter((p) => new Date(p.properties.lastSeen) >= weekAgo);
  const olderProps = activeListings.filter((p) => {
    const d = new Date(p.properties.lastSeen);
    return d >= twoWeeksAgo && d < weekAgo;
  });
  const recentAvg = recentProps.length > 0 ? recentProps.reduce((s, p) => s + (p.properties.price / (p.properties.area ?? 70)), 0) / recentProps.length : 0;
  const olderAvg = olderProps.length > 0 ? olderProps.reduce((s, p) => s + (p.properties.price / (p.properties.area ?? 70)), 0) / olderProps.length : 0;
  const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  const priceDrops = activeListings.filter((p) => {
    // Simplification: properties with updated_at != first_seen may have had price changes
    return new Date(p.properties.lastSeen).getTime() - new Date(p.properties.firstSeen).getTime() > 86400000 * 14;
  }).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trh</h1>
        <p className="text-sm text-muted mt-1">Přehled realitního trhu z nasbíraných dat ({totalListings} inzerátů)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Aktivních inzerátů", value: activeListings.length.toString(), sub: `z ${totalListings} celkem`, icon: ArrowUp },
          { label: "Ø cena/m²", value: fmtPrice(avgPricePerSqm), sub: `${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}% trend`, icon: trendIcon(trendPct) },
          { label: "Ø dny na trhu", value: avgDays.toString(), sub: "dní", icon: Clock },
          { label: "Potenciální dropy", value: `${Math.round((priceDrops / Math.max(activeListings.length, 1)) * 100)}%`, sub: "inzerátů 14+ dní", icon: SealCheck },
        ].map((s, i) => (
          <div key={s.label} className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted">{s.label}</span>
              <s.icon size={16} className="text-muted" weight="duotone" />
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
                {cityRows.map((loc) => (
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

      <div>
        <h2 className="font-semibold tracking-tight mb-4">Top lokality podle skóre</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeListings
            .filter((p) => p.property_analysis?.investmentScore)
            .sort((a, b) => (b.property_analysis?.investmentScore ?? 0) - (a.property_analysis?.investmentScore ?? 0))
            .slice(0, 4)
            .map((p, i) => {
              const city = p.property_analysis?.locationCity ?? "Neznámá";
              const score = p.property_analysis?.investmentScore ?? 0;
              return (
                <div key={p.properties.id} className="rounded-2xl border border-border/50 bg-card p-5">
                  <p className="text-sm font-medium truncate">{p.properties.title}</p>
                  <p className="text-xs text-muted capitalize mt-0.5">{city.replace(/_/g, " ")}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted">Skóre</span>
                    <span className={`font-mono font-semibold text-lg ${score >= 60 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400"}`}>
                      {score}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
