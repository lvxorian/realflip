"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { X, Phone, Envelope, ArrowSquareOut, Check } from "@phosphor-icons/react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate, conditionLabel, buildingTypeLabel, portalLabel } from "@/lib/utils";
import { LEAD_STAGES } from "@/lib/leads";
import { toast } from "sonner";
import type { LeadItem } from "./types";

const PRIORITY_OPTIONS = [
  { value: 0, label: "Žádná" },
  { value: 1, label: "Nízká" },
  { value: 2, label: "Střední" },
  { value: 3, label: "Vysoká" },
];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className="text-xs text-foreground font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

export function LeadDrawer({
  lead,
  onClose,
  onLeadUpdated,
  onConverted,
}: {
  lead: LeadItem | null;
  onClose: () => void;
  onLeadUpdated: (lead: LeadItem) => void;
  onConverted: (leadId: string) => void;
}) {
  const [stage, setStage] = useState(lead?.stage ?? "new");
  const [priority, setPriority] = useState(lead?.priority ?? 0);
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertPrice, setConvertPrice] = useState(lead?.propertyPrice?.toString() ?? "");
  const [convertRenovation, setConvertRenovation] = useState("");

  const stageMeta = LEAD_STAGES.find((s) => s.key === stage);

  async function saveChanges() {
    if (!lead) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, priority, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Uložení se nezdařilo");
        return;
      }
      const updated = await res.json();
      onLeadUpdated({ ...lead, stage, priority, notes, ...(updated.lead ?? {}) });
      toast.success("Změny uloženy");
    } catch {
      toast.error("Uložení se nezdařilo — zkontrolujte připojení");
    } finally {
      setSaving(false);
    }
  }

  async function convertToDeal() {
    if (!lead) return;
    const price = parseInt(convertPrice, 10);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Zadejte platnou kupní cenu");
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchasePrice: price, renovationBudget: parseInt(convertRenovation, 10) || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Převod na deal selhal");
        return;
      }
      toast.success("Lead převeden na deal");
      onConverted(lead.id);
      onClose();
    } catch {
      toast.error("Převod na deal selhal");
    } finally {
      setConverting(false);
    }
  }

  return (
    <AnimatePresence>
      {lead && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-dvh w-full max-w-md overflow-y-auto bg-background border-l border-border/50 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between sticky top-0 z-10 bg-background/95 backdrop-blur px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2 min-w-0">
                <ScoreGauge score={lead.analysisScore ?? 0} size={30} strokeWidth={2.5} />
                <span className="text-sm font-medium truncate">{lead.propertyTitle ?? "Neznámá nemovitost"}</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card text-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-semibold font-mono text-amber-400">
                  {lead.propertyPrice ? formatPrice(lead.propertyPrice) : "—"}
                </span>
                {lead.propertyPricePerSqm != null && (
                  <span className="text-xs text-muted font-mono">{formatPrice(lead.propertyPricePerSqm)}/m²</span>
                )}
                <Badge variant="outline" size="sm" className="ml-auto gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${stageMeta?.dot ?? "bg-border"}`} />
                  {stageMeta?.label ?? stage}
                </Badge>
              </div>

              <div className="rounded-xl border border-border/40 divide-y divide-border/30">
                <div className="px-4 py-3">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Nemovitost</h3>
                  <div className="divide-y divide-border/20">
                    <InfoRow label="Adresa" value={lead.propertyAddress} />
                    <InfoRow label="Plocha" value={lead.propertyArea != null ? `${lead.propertyArea} m²` : null} />
                    <InfoRow label="Dispozice" value={lead.propertyRooms} />
                    <InfoRow label="Stav" value={conditionLabel(lead.propertyCondition)} />
                    <InfoRow label="Konstrukce" value={buildingTypeLabel(lead.propertyBuildingType)} />
                    <InfoRow label="Rok výstavby" value={lead.propertyYearBuilt ?? null} />
                    <InfoRow label="Portál" value={portalLabel(lead.propertyPortalName)} />
                  </div>
                  {lead.propertyId && (
                    <Link
                      href={`/properties/${lead.propertyId}`}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      <ArrowSquareOut size={13} /> Otevřít nemovitost
                    </Link>
                  )}
                </div>

                {(lead.contactName || lead.contactPhone || lead.contactEmail) && (
                  <div className="px-4 py-3">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Kontakt</h3>
                    <p className="text-sm font-medium">{lead.contactName ?? "Bez jména"}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {lead.contactPhone && (
                        <a
                          href={`tel:${lead.contactPhone}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-card border border-border/50 px-2.5 py-1.5 text-xs hover:border-accent/40 transition-colors"
                        >
                          <Phone size={13} className="text-accent" /> {lead.contactPhone}
                        </a>
                      )}
                      {lead.contactEmail && (
                        <a
                          href={`mailto:${lead.contactEmail}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-card border border-border/50 px-2.5 py-1.5 text-xs hover:border-accent/40 transition-colors min-w-0"
                        >
                          <Envelope size={13} className="text-accent" /> <span className="truncate">{lead.contactEmail}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/40 px-4 py-3 space-y-3">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">Řízení</h3>
                <div>
                  <label className="text-xs text-muted block mb-1">Fáze</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-sm focus:outline-none focus:border-accent/50 cursor-pointer"
                  >
                    {LEAD_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Priorita</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                    className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-sm focus:outline-none focus:border-accent/50 cursor-pointer"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Poznámky</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Dohody, ceny, reakce vlastníka..."
                    className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                  />
                </div>
                <Button onClick={saveChanges} disabled={saving} className="w-full text-sm">
                  {saving ? "Ukládám..." : "Uložit změny"}
                </Button>
              </div>

              {lead.stage === "closed" && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 space-y-3">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Převod na deal</h3>
                  <Input
                    label="Kupní cena"
                    type="number"
                    value={convertPrice}
                    onChange={(e) => setConvertPrice(e.target.value)}
                    placeholder={lead.propertyPrice?.toString() ?? "0"}
                  />
                  <Input
                    label="Rozpočet na reko"
                    type="number"
                    value={convertRenovation}
                    onChange={(e) => setConvertRenovation(e.target.value)}
                    placeholder="např. 500000"
                  />
                  <Button onClick={convertToDeal} disabled={converting} className="w-full text-sm" variant="default">
                    <Check size={14} weight="bold" /> {converting ? "Převádím..." : "Převést na deal"}
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted/50 pb-2">
                <span>{lead.createdAt != null ? `Vytvořeno: ${formatDate(lead.createdAt)}` : ""}</span>
                <span>{lead.updatedAt != null ? `Aktualizováno: ${formatDate(lead.updatedAt)}` : ""}</span>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
