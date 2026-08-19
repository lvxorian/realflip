"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { modelLabel, COOPERATION_STRATEGIES } from "@/lib/cooperation-models";
import { SealCheck } from "@phosphor-icons/react";
import { toast } from "sonner";

export type ReservationRow = {
  leadId: string;
  propertyId: string;
  propertyTitle: string | null;
  propertyAddress: string | null;
  propertyUrl: string | null;
  calcMode: string | null;
  strategy: string | null;
  reservedAt: number | null;
  expiresAt: number | null;
};

function reservationCountdown(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "vypršelo";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}

export function InvestorReservations({ reservations }: { reservations: ReservationRow[] }) {
  const [releasing, setReleasing] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  async function releaseReservation(leadId: string) {
    setReleasing(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/portal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalReservedInvestorId: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Rezervaci se nepodařilo uvolnit");
        return;
      }
      toast.success("Rezervace uvolněna — nabídka je zase dostupná investorům");
      // Reload page to reflect the change
      window.location.reload();
    } catch {
      toast.error("Rezervaci se nepodařilo uvolnit");
    } finally {
      setReleasing(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left p-4 text-xs text-muted font-medium">Nemovitost</th>
              <th className="text-left p-4 text-xs text-muted font-medium">Model</th>
              <th className="text-left p-4 text-xs text-muted font-medium">Spolupráce</th>
              <th className="text-right p-4 text-xs text-muted font-medium">Vyprší za</th>
              <th className="text-right p-4 text-xs text-muted font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {reservations.map((r) => {
              const isExpired = r.expiresAt != null && r.expiresAt <= now;
              const countdown =
                r.expiresAt != null
                  ? isExpired
                    ? "vypršelo"
                    : reservationCountdown(r.expiresAt)
                  : "—";

              return (
                <tr key={r.leadId} className="hover:bg-card-hover transition-colors">
                  <td className="p-4">
                    <Link
                      href={r.propertyUrl ?? `/properties/${r.propertyId}`}
                      className="font-medium hover:underline truncate max-w-[280px] block"
                    >
                      {r.propertyTitle ?? "Neznámá nemovitost"}
                    </Link>
                    {r.propertyAddress && (
                      <p className="text-xs text-muted truncate max-w-[280px]">
                        {r.propertyAddress}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" size="sm">
                      {modelLabel(r.calcMode)}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" size="sm">
                      {r.strategy && r.strategy in COOPERATION_STRATEGIES
                        ? COOPERATION_STRATEGIES[r.strategy as keyof typeof COOPERATION_STRATEGIES]
                        : "—"}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    {isExpired ? (
                      <span className="text-xs text-muted font-mono">vypršelo</span>
                    ) : (
                      <span className="text-xs font-mono tabular-nums">
                        <SealCheck
                          size={12}
                          weight="fill"
                          className="inline text-emerald-400 mr-1 -mt-0.5"
                        />
                        {countdown}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => releaseReservation(r.leadId)}
                      disabled={releasing === r.leadId}
                      className="text-xs px-3 py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 hover:border-danger/40 transition-colors disabled:opacity-50"
                    >
                      {releasing === r.leadId ? "Uvolňuji…" : "Uvolnit rezervaci"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
