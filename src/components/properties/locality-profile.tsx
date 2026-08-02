"use client";

import { useEffect, useState } from "react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { MapPin, Building, Users, ShieldCheck, Footprints, CurrencyCircleDollar, Train } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { LocalityFactors } from "@/lib/locality/types";

interface LocalityResponse {
  locality: {
    cityKey: string;
    district: string;
    quarterLabel: string | null;
    score: number;
    factors: LocalityFactors;
    fetchedAt?: number;
  } | null;
}

interface LocalityProfileProps {
  cityKey: string | null;
  district: string | null;
  aiVerdict?: string | null;
}

function scoreColor(score: number) {
  return score >= 80 ? "text-emerald-400" : score >= 60 ? "text-accent" : score >= 40 ? "text-amber-400" : "text-red-400";
}

interface AiVerdict {
  ok: boolean;
  warnings: string[];
  notes: string;
}

function Dim({
  icon,
  label,
  score,
  detail,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  detail?: string;
  empty?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card-hover/60 border border-border/50 px-3 py-2.5">
      <span className="text-muted shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        {empty ? (
          <p className="text-[10px] text-muted/40">bez dostupných dat</p>
        ) : detail ? (
          <p className="text-[10px] text-muted/50 truncate" title={detail}>{detail}</p>
        ) : null}
      </div>
      <ScoreGauge score={score} size={30} strokeWidth={2.5} />
    </div>
  );
}

export function LocalityProfile({ cityKey, district, aiVerdict }: LocalityProfileProps) {
  const [data, setData] = useState<LocalityResponse["locality"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!cityKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/locality/${encodeURIComponent(cityKey)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: LocalityResponse) => {
        if (!cancelled) {
          setData(d.locality);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cityKey]);

  if (!cityKey || loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="h-5 w-48 rounded bg-border/20 animate-pulse mb-3" />
        <div className="h-24 rounded-xl bg-border/10 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const f = data.factors;
  const cityLabel = data.cityKey.replace(/_/g, " ");
  const locationLabel = data.quarterLabel
    ? `${data.quarterLabel} · ${cityLabel}`
    : data.district
    ? `${cityLabel} · ${data.district}`
    : cityLabel;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-2 text-sm mb-4">
        <MapPin size={16} className="text-accent shrink-0" weight="duotone" />
        <span className="font-medium">Socio-ekonomický profil lokality</span>
        <span className="text-xs text-muted capitalize ml-auto truncate min-w-0" title={locationLabel}>{locationLabel}</span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <ScoreGauge score={data.score} size={52} strokeWidth={3.5} />
        <div>
          <p className="text-sm font-semibold">Lokalitní skóre {data.score}/100</p>
          <p className={cn("text-[11px]", scoreColor(data.score))}>
            {data.score >= 80 ? "Výborná lokalita" : data.score >= 60 ? "Nadprůměrná lokalita" : data.score >= 40 ? "Průměrná lokalita" : "Podprůměrná lokalita"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Dim
          icon={<Users size={15} weight="duotone" />}
          label="Ekonomika"
          score={f.economic.score}
          detail={f.economic.unemploymentPct != null ? `nezaměstnanost ${f.economic.unemploymentPct} %` : undefined}
          empty={f.economic.unemploymentPct == null && f.economic.firms == null}
        />
        <Dim
          icon={<Building size={15} weight="duotone" />}
          label="Demografie"
          score={f.demographic.score}
          detail={f.demographic.migrationNet != null ? `migrace +${f.demographic.migrationNet.toFixed(1)}‰` : undefined}
          empty={f.demographic.migrationNet == null && f.demographic.population == null}
        />
        <Dim
          icon={<Footprints size={15} weight="duotone" />}
          label="Vybavenost"
          score={f.walkability.score}
          detail={f.walkability.score > 0 ? `${f.walkability.score}/100` : undefined}
          empty={f.walkability.score === 0}
        />
        <Dim
          icon={<Train size={15} weight="duotone" />}
          label="Doprava"
          score={f.transport.score}
          detail={f.transport.premiumPct != null ? `prémie +${f.transport.premiumPct} %` : undefined}
          empty={f.transport.score === 0 && f.transport.premiumPct == null}
        />
        <Dim
          icon={<ShieldCheck size={15} weight="duotone" />}
          label="Bezpečnost"
          score={f.safety.score}
          detail={f.safety.crimeIndex != null ? `index kriminality ${f.safety.crimeIndex}` : undefined}
          empty={f.safety.crimeIndex == null}
        />
        <Dim
          icon={<CurrencyCircleDollar size={15} weight="duotone" />}
          label="Rentový výnos"
          score={f.rental.score}
          detail={f.rental.rentPerSqm != null ? `${f.rental.rentPerSqm} Kč/m² · ${f.rental.grossYieldPct ?? "?"} %` : undefined}
          empty={f.rental.rentPerSqm == null}
        />
      </div>

      {f.missing.length > 0 && (
        <p className="text-[10px] text-muted/40 mt-3">
          Nedostupná data: {f.missing.join(", ")}
        </p>
      )}

      {(() => {
        if (!aiVerdict) return null;
        let parsed: AiVerdict | null = null;
        try {
          parsed = JSON.parse(aiVerdict);
        } catch {
          parsed = null;
        }
        if (!parsed) return null;
        const hasWarnings = parsed.warnings.length > 0;
        return (
          <div className={`mt-3 rounded-xl border px-3 py-2.5 text-xs ${hasWarnings ? "border-amber-500/25 bg-amber-500/5" : "border-emerald-500/25 bg-emerald-500/5"}`}>
            <div className="flex items-center gap-1.5 font-medium">
              <span className={hasWarnings ? "text-amber-400" : "text-emerald-400"}>
                {hasWarnings ? "⚠" : "✓"}
              </span>
              <span className={hasWarnings ? "text-amber-400" : "text-emerald-400"}>
                {hasWarnings ? "AI: podezřelé hodnoty" : "AI: data ověřena"}
              </span>
            </div>
            {hasWarnings && (
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-400/90">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {parsed.notes && <p className="mt-1 text-[11px] text-muted/60">{parsed.notes}</p>}
          </div>
        );
      })()}
    </div>
  );
}
