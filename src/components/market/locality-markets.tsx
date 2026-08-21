"use client";

import { useEffect, useState } from "react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { Button } from "@/components/ui/button";
import { ArrowClockwise, MapPin } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { LocalityFactors } from "@/lib/locality/types";

interface LocalityRow {
  cityKey: string;
  score: number | null;
  unemployment: number | null;
  migrationPer1000: number | null;
  walkability: number | null;
  crimeIndex: number | null;
}

interface ApiRow {
  results: {
    cityKey: string;
    locality: {
      cityKey: string;
      score: number;
      factors: LocalityFactors;
    } | null;
  }[];
}

export function LocalityMarkets({ cities }: { cities: string[] }) {
  const [rows, setRows] = useState<LocalityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    const valid = [...new Set(cities.filter((c) => c && c !== "Neznámá" && c !== "unknown"))];
    if (valid.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      // Jeden batch request místo N sekvenčních /api/locality/{city}
      const res = await fetch(`/api/locality?cities=${encodeURIComponent(valid.join(","))}`, { cache: "no-store" });
      const d: ApiRow = await res.json();
      const results: LocalityRow[] = [];
      for (const item of d.results ?? []) {
        const s = item.locality;
        if (!s) continue;
        results.push({
          cityKey: s.cityKey,
          score: s.score,
          unemployment: s.factors.economic.unemploymentPct ?? null,
          migrationPer1000: s.factors.demographic.migrationNet ?? null,
          walkability: s.factors.walkability.score,
          crimeIndex: s.factors.safety.crimeIndex ?? null,
        });
      }
      setRows(results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)));
    } catch {
      // skip
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/locality/refresh", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Obnova selhala");
      } else {
        toast.success(`Obnoveno: ${data?.ok ?? 0} dat z ${data?.cities ?? 0} měst`);
        await load();
      }
    } catch {
      toast.error("Chyba sítě");
    }
    setRefreshing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold tracking-tight">Lokality — socio-ekonomické skóre</h2>
        <Button size="sm" variant="secondary" onClick={refresh} disabled={loading || refreshing} className="text-xs gap-1.5">
          <ArrowClockwise size={13} className={refreshing ? "animate-spin" : ""} weight="bold" />
          Obnovit data
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="p-5 text-sm text-muted">Načítám lokalitní data…</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-5 flex items-center gap-3 text-sm text-muted">
          <MapPin size={16} className="text-accent" weight="duotone" />
          Zatím žádná lokalitní data — klikněte na „Obnovit data“.
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-4 text-xs text-muted font-medium">Lokalita</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Skóre</th>
                  <th className="text-right p-4 text-xs text-muted font-medium hidden sm:table-cell">Nezaměstnanost</th>
                  <th className="text-right p-4 text-xs text-muted font-medium hidden md:table-cell">Migrace ‰</th>
                  <th className="text-right p-4 text-xs text-muted font-medium hidden lg:table-cell">Vybavenost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {rows.map((r) => (
                  <tr key={r.cityKey} className="hover:bg-card-hover transition-colors">
                    <td className="p-4 font-medium capitalize">{r.cityKey.replace(/_/g, " ")}</td>
                    <td className="p-4 text-right">
                      <ScoreGauge score={r.score ?? 0} size={30} strokeWidth={2.5} />
                    </td>
                    <td className="p-4 text-right font-mono text-muted hidden sm:table-cell">
                      {r.unemployment != null ? `${r.unemployment} %` : "—"}
                    </td>
                    <td className="p-4 text-right font-mono text-muted hidden md:table-cell">
                      {r.migrationPer1000 != null ? `${r.migrationPer1000 > 0 ? "+" : ""}${r.migrationPer1000.toFixed(1)}` : "—"}
                    </td>
                    <td className="p-4 text-right font-mono text-muted hidden lg:table-cell">
                      {r.walkability != null ? `${r.walkability}/100` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
