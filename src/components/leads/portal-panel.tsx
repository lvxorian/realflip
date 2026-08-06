"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LockSimple, Eye, EyeSlash, Prohibit } from "@phosphor-icons/react";

interface InvestorOption {
  id: string;
  name: string | null;
}

interface PortalPanelProps {
  leadId: string;
  initialVisible: boolean;
  initialReservedInvestorId: string | null;
  removed?: boolean;
}

export function PortalPanel({ leadId, initialVisible, initialReservedInvestorId, removed = false }: PortalPanelProps) {
  const [visible, setVisible] = useState(initialVisible);
  const [reservedInvestorId, setReservedInvestorId] = useState(initialReservedInvestorId);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d: InvestorOption[]) => {
        if (Array.isArray(d)) setInvestors(d);
      })
      .catch(() => {});
  }, []);

  async function save(patch: { portalVisible?: boolean; portalStatus?: string; portalReservedInvestorId?: string | null }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/portal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error("Uložení se nepodařilo");
        return;
      }
      toast.success("Portál uložen");
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-2 text-sm mb-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <LockSimple size={16} weight="duotone" />
        </span>
        <span className="font-medium">Portál investorů</span>
        {reservedInvestorId && (
          <Badge variant="warning" size="sm" className="ml-auto">Rezervováno</Badge>
        )}
      </div>

      <div className="space-y-3 text-sm">
        {removed && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 flex items-start gap-2">
            <Prohibit size={14} weight="fill" className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted leading-relaxed">
              Inzerát odstraněn — investorům se nabídka nezobrazuje. Rezervace zůstává v systému a při znovunalezení inzerátu se obnoví.
            </p>
          </div>
        )}

        <button
          onClick={() => {
            const next = !visible;
            setVisible(next);
            save({ portalVisible: next });
          }}
          disabled={saving}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5 hover:bg-card-hover transition-colors disabled:opacity-50"
        >
          <span className="flex items-center gap-2 text-foreground/80">
            {visible ? <Eye size={15} weight="bold" className="text-accent" /> : <EyeSlash size={15} weight="bold" className="text-muted" />}
            Zobrazit investorům
          </span>
          <span
            className={`flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors ${
              visible ? "justify-end bg-accent/30 border-accent/40" : "justify-start bg-card border-border"
            }`}
          >
            <span className={`h-4 w-4 rounded-full transition-colors ${visible ? "bg-accent" : "bg-muted/40"}`} />
          </span>
        </button>

        {visible && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted shrink-0 w-24">Rezervováno pro</label>
              <select
                value={reservedInvestorId ?? ""}
                disabled={saving}
                onChange={(e) => {
                  const value = e.target.value;
                  setReservedInvestorId(value || null);
                  save({ portalReservedInvestorId: value || null });
                }}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-accent/50 transition-colors"
              >
                <option value="">— Volná nabídka —</option>
                {investors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name ?? "Neznámý investor"}
                  </option>
                ))}
              </select>
            </div>

            {reservedInvestorId && (
              <Button
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setReservedInvestorId(null);
                  save({ portalReservedInvestorId: null });
                }}
                className="w-full gap-1.5"
              >
                <EyeSlash size={13} weight="bold" />
                Uvolnit rezervaci
              </Button>
            )}

            <p className="text-xs text-muted">
              Investorům se ukazuje jen makrolokalita, stav, m² a ceny — bez adresy a fotek.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}