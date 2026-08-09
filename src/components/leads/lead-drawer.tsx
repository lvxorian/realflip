"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  X, Phone, Envelope, ArrowSquareOut, Check, Plus,
  ArrowsLeftRight, CurrencyCircleDollar, CalendarBlank, NotePencil,
  ListChecks, CheckCircle, WarningCircle, Handshake,
} from "@phosphor-icons/react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate, conditionLabel, buildingTypeLabel, portalLabel } from "@/lib/utils";
import { PropertyImage } from "@/components/ui/property-image";
import { RemovedListingBadge } from "@/components/ui/removed-listing-badge";
import { LEAD_STAGES, LOST_REASONS } from "@/lib/leads";
import { toast } from "sonner";
import type { LeadEvent } from "@/lib/lead-events";
import type { LeadItem, StageData } from "./types";

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
      <span className="text-xs text-foreground font-medium text-right break-words min-w-0">{value ?? "—"}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 px-4 py-3 space-y-3">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

const labelClass = "text-xs text-muted block mb-1";
const inputClass =
  "w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-sm focus:outline-none focus:border-accent/50 transition-colors";

function parseDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
            <LeadDrawerContent
              key={lead.id}
              lead={lead}
              onClose={onClose}
              onLeadUpdated={onLeadUpdated}
              onConverted={onConverted}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function LeadDrawerContent({
  lead,
  onClose,
  onLeadUpdated,
  onConverted,
}: {
  lead: LeadItem;
  onClose: () => void;
  onLeadUpdated: (lead: LeadItem) => void;
  onConverted: (leadId: string) => void;
}) {
  const [stage, setStage] = useState(lead.stage);
  const [priority, setPriority] = useState(lead.priority ?? 0);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [stageData, setStageData] = useState<StageData>(() => lead.stageData ?? {});
  const [nextStep, setNextStep] = useState(lead.nextStep ?? "");
  const [nextStepDueAt, setNextStepDueAt] = useState(lead.nextStepDueAt);
  const [lostReason, setLostReason] = useState(lead.lostReason ?? "");
  const [events, setEvents] = useState<LeadEvent[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertPrice, setConvertPrice] = useState(lead.propertyPrice?.toString() ?? "");
  const [convertRenovation, setConvertRenovation] = useState("");
  const [investors, setInvestors] = useState<{ id: string; name: string }[]>([]);
  const [investorId, setInvestorId] = useState("");

  useEffect(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d: { id: string; name: string }[]) => {
        if (Array.isArray(d)) setInvestors(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${lead.id}/events`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: LeadEvent[]) => {
        if (!cancelled) setEvents(d);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  const stageMeta = LEAD_STAGES.find((s) => s.key === stage);

  const updateStageData = (patch: Partial<StageData>) =>
    setStageData((prev) => ({ ...prev, ...patch }));

  function handleStageChange(value: string) {
    setStage(value);
    // Předvyplnit nabídnutou cenu z analýzy při přetažení do fáze "Nabídka"
    if (value === "offer" && stageData.offer?.amount == null && lead.analysisTargetPurchasePrice) {
      updateStageData({
        offer: {
          amount: lead.analysisTargetPurchasePrice,
          expiresAt: stageData.offer?.expiresAt ?? null,
          items: stageData.offer?.items ?? [],
        },
      });
    }
    // Předvyplnit kupní cenu z nabídky při převodu na deal
    if (value === "closed" && stageData.offer?.amount != null && !convertPrice) {
      setConvertPrice(String(stageData.offer.amount));
    }
  }

  async function saveChanges() {
    if (stage === "lost" && !lostReason) {
      toast.error("Vyberte důvod, proč je lead ztracený");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          priority,
          notes,
          stageData,
          nextStep: nextStep.trim() || null,
          nextStepDueAt: nextStepDueAt ?? null,
          lostReason: lostReason || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Uložení se nezdařilo");
        return;
      }
      const updated = await res.json();
      onLeadUpdated({
        ...lead,
        stage,
        priority,
        notes,
        stageData,
        nextStep: nextStep.trim() || null,
        nextStepDueAt: nextStepDueAt ?? null,
        lostReason: lostReason || null,
        stageEnteredAt: stage !== lead.stage ? Date.now() : lead.stageEnteredAt,
        updatedAt: Date.now(),
        ...(updated.lead ?? {}),
      });
      toast.success("Změny uloženy");
    } catch {
      toast.error("Uložení se nezdařilo — zkontrolujte připojení");
    } finally {
      setSaving(false);
    }
  }

  async function convertToDeal() {
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
        body: JSON.stringify({ purchasePrice: price, renovationBudget: parseInt(convertRenovation, 10) || null, investorId: investorId || null }),
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

  const addOfferHistory = () => {
    const amount = stageData.offer?.amount;
    if (amount == null || amount <= 0) {
      toast.error("Zadejte nabídnutou cenu");
      return;
    }
    const items = [...(stageData.offer?.items ?? []), { price: amount, date: new Date().toISOString() }];
    updateStageData({ offer: { amount, expiresAt: stageData.offer?.expiresAt ?? null, items } });
    toast.success("Nabídka zaznamenána");
  };

  const addNegotiationHistory = (by: "us" | "them") => {
    const amount = stageData.negotiation?.currentAmount;
    if (amount == null || amount <= 0) {
      toast.error("Zadejte aktuální částku");
      return;
    }
    const history = [...(stageData.negotiation?.history ?? []), { price: amount, date: new Date().toISOString(), by }];
    updateStageData({ negotiation: { currentAmount: amount, history } });
  };

  return (
    <div className="flex h-full flex-col">
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
        {(lead.propertyImageUrl || lead.propertyRemoved) && (
          <div className="overflow-hidden rounded-xl">
            <PropertyImage
              src={lead.propertyImageUrl}
              alt={lead.propertyTitle ?? "Nemovitost"}
              score={lead.analysisScore}
              showScore={false}
              removed={lead.propertyRemoved}
              containerClassName="h-40 w-full"
            />
          </div>
        )}

        {lead.propertyRemoved && (
          <div
            className={
              lead.stage === "closed" || lead.stage === "lost"
                ? "rounded-xl border border-border/40 bg-card px-4 py-3 flex items-center gap-2"
                : "rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3"
            }
          >
            <div className="flex items-start gap-2">
              <RemovedListingBadge neutral={lead.stage === "closed" || lead.stage === "lost"} />
              <p className="text-xs text-muted leading-relaxed">
                {lead.stage === "closed" || lead.stage === "lost"
                  ? "Inzerát zmizel z portálu — očekávané pro uzavřený/ztracený deal. Záznam zůstává plně zachován."
                  : "Inzerát byl odstraněn z portálu — nemovitost se pravděpodobně prodala. Kontakt zůstává dostupný; stav ověřte u prodejce."}
              </p>
            </div>
          </div>
        )}

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
              onChange={(e) => handleStageChange(e.target.value)}
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
          <div>
            <label className="text-xs text-muted block mb-1">Další krok</label>
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="např. zavolat prodejci, poslat nabídku..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Termín dalšího kroku</label>
            <input
              type="date"
              value={nextStepDueAt ? new Date(nextStepDueAt).toISOString().slice(0, 10) : ""}
              onChange={(e) => setNextStepDueAt(e.target.value ? new Date(e.target.value + "T12:00:00").getTime() : null)}
              className={inputClass}
            />
          </div>
        </div>

        {/* ===== Fáze Schůzka ===== */}
        {stage === "meeting" && (
          <SectionCard title="📅 Schůzka">
            <div>
              <label className={labelClass}>Kdy</label>
              <input
                type="datetime-local"
                value={parseDate(stageData.meeting?.date)}
                onChange={(e) =>
                  updateStageData({
                    meeting: { ...stageData.meeting, date: e.target.value || null, location: stageData.meeting?.location ?? null },
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kde</label>
              <input
                value={stageData.meeting?.location ?? ""}
                onChange={(e) =>
                  updateStageData({
                    meeting: { ...stageData.meeting, date: stageData.meeting?.date ?? null, location: e.target.value || null },
                  })
                }
                placeholder="např. kavárna, Vodičkova 12, Praha 1"
                className={inputClass}
              />
            </div>
          </SectionCard>
        )}

        {/* ===== Fáze Nabídka ===== */}
        {stage === "offer" && (
          <SectionCard title="💰 Nabídka">
            <div>
              <label className={labelClass}>
                Nabídnutá cena
                {lead.analysisTargetPurchasePrice ? (
                  <span className="text-muted/60 ml-1">
                    (analýza: {formatPrice(lead.analysisTargetPurchasePrice)})
                  </span>
                ) : null}
              </label>
              <input
                type="number"
                value={stageData.offer?.amount ?? ""}
                onChange={(e) => {
                  const amount = e.target.value ? parseInt(e.target.value, 10) : null;
                  updateStageData({ offer: { ...stageData.offer, amount, expiresAt: stageData.offer?.expiresAt ?? null } });
                }}
                placeholder={lead.analysisTargetPurchasePrice?.toString() ?? "0"}
                className={inputClass + " font-mono"}
              />
            </div>
            <div>
              <label className={labelClass}>Platnost nabídky do</label>
              <input
                type="date"
                value={(stageData.offer?.expiresAt ?? "").slice(0, 10)}
                onChange={(e) =>
                  updateStageData({ offer: { ...stageData.offer, amount: stageData.offer?.amount ?? null, expiresAt: e.target.value || null } })
                }
                className={inputClass}
              />
            </div>
            <Button size="sm" variant="secondary" onClick={addOfferHistory} className="w-full gap-1.5">
              <Plus size={14} weight="bold" /> Zaznamenat nabídku
            </Button>
            {(stageData.offer?.items?.length ?? 0) > 0 && (
              <div className="space-y-1">
                {stageData.offer!.items!.map((it, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-card-hover px-2.5 py-1.5 text-xs">
                    <span className="font-mono text-foreground">{formatPrice(it.price)}</span>
                    <span className="text-muted">{new Date(it.date).toLocaleDateString("cs-CZ")}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ===== Fáze Vyjednávání ===== */}
        {stage === "negotiation" && (
          <SectionCard title="🤝 Vyjednávání">
            <div>
              <label className={labelClass}>Aktuální částka</label>
              <input
                type="number"
                value={stageData.negotiation?.currentAmount ?? ""}
                onChange={(e) => {
                  const currentAmount = e.target.value ? parseInt(e.target.value, 10) : null;
                  updateStageData({ negotiation: { ...stageData.negotiation, currentAmount, history: stageData.negotiation?.history ?? [] } });
                }}
                placeholder={lead.analysisTargetPurchasePrice?.toString() ?? "0"}
                className={inputClass + " font-mono"}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => addNegotiationHistory("us")} className="flex-1 gap-1.5">
                <Plus size={13} weight="bold" /> My
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addNegotiationHistory("them")} className="flex-1 gap-1.5">
                <Plus size={13} weight="bold" /> Oni
              </Button>
            </div>
            {(stageData.negotiation?.history?.length ?? 0) > 0 && (
              <div className="space-y-1">
                {stageData.negotiation!.history!.map((it, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-card-hover px-2.5 py-1.5 text-xs">
                    <span className="font-mono text-foreground">{formatPrice(it.price)}</span>
                    <span className={`text-[10px] ${it.by === "us" ? "text-accent" : "text-amber-400"}`}>
                      {it.by === "us" ? "my" : "oni"} · {new Date(it.date).toLocaleDateString("cs-CZ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ===== Ztraceno ===== */}
        {stage === "lost" && (
          <SectionCard title="🤷 Ztraceno — proč?">
            <select
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className={inputClass + " cursor-pointer"}
            >
              <option value="">Vyberte důvod...</option>
              {LOST_REASONS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <p className="flex items-center gap-1.5 text-[10px] text-muted">
              <WarningCircle size={11} className="text-amber-400/80 shrink-0" />
              Důvod se uloží společně se změnami a ukáže se v historii.
            </p>
          </SectionCard>
        )}

        {/* ===== Uložit ===== */}
        <Button onClick={saveChanges} disabled={saving} className="w-full text-sm">
          {saving ? "Ukládám..." : "Uložit změny"}
        </Button>

        {stage === "closed" && (
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
            <div>
              <label className={labelClass}>Investor</label>
              <select
                value={investorId}
                onChange={(e) => setInvestorId(e.target.value)}
                className={inputClass}
              >
                <option value="">Sám financuji</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted mt-1">
                {investorId ? "Investor se zapojí do tohoto projektu." : "Projekt si financujete sami."}
              </p>
            </div>
            <Button onClick={convertToDeal} disabled={converting} className="w-full text-sm" variant="default">
              <Check size={14} weight="bold" /> {converting ? "Převádím..." : "Převést na deal"}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted/50 pb-2">
          <span>{lead.createdAt != null ? `Vytvořeno: ${formatDate(lead.createdAt)}` : ""}</span>
          <span>{lead.updatedAt != null ? `Aktualizováno: ${formatDate(lead.updatedAt)}` : ""}</span>
        </div>

        {/* ===== Aktivita (timeline) ===== */}
        <section className="pb-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Aktivita</h3>
          {events === null ? (
            <p className="text-xs text-muted/50">Načítám historii...</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted/50">Zatím žádné události.</p>
          ) : (
            <ol className="relative space-y-3 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border/40">
              {events.map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

const EVENT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  stage_changed: { icon: <ArrowsLeftRight size={13} weight="bold" />, color: "text-accent bg-accent/10" },
  offer: { icon: <CurrencyCircleDollar size={13} weight="bold" />, color: "text-amber-400 bg-amber-500/10" },
  negotiation: { icon: <Handshake size={13} weight="bold" />, color: "text-emerald-400 bg-emerald-500/10" },
  meeting: { icon: <CalendarBlank size={13} weight="bold" />, color: "text-blue-400 bg-blue-500/10" },
  notes: { icon: <NotePencil size={13} weight="bold" />, color: "text-muted bg-border/20" },
  next_step: { icon: <ListChecks size={13} weight="bold" />, color: "text-accent bg-accent/10" },
  converted: { icon: <CheckCircle size={13} weight="bold" />, color: "text-emerald-400 bg-emerald-500/10" },
};

function EventRow({ event }: { event: LeadEvent }) {
  const meta = EVENT_META[event.type] ?? { icon: <NotePencil size={13} weight="bold" />, color: "text-muted bg-border/20" };
  const p = event.payload;

  let title = "Událost";
  if (event.type === "stage_changed") {
    title = `Změna fáze: ${p.fromLabel ?? p.from ?? "?"} → ${p.toLabel ?? p.to ?? "?"}`;
  } else if (event.type === "offer") {
    title = `Nabídka: ${typeof p.amount === "number" ? formatPrice(p.amount) : "?"}`;
  } else if (event.type === "negotiation") {
    title = `Vyjednávání: ${typeof p.amount === "number" ? formatPrice(p.amount) : "?"}`;
  } else if (event.type === "meeting") {
    const date = typeof p.date === "string" ? p.date : "";
    title = date ? `Schůzka: ${new Date(date).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}` : "Schůzka naplánována";
  } else if (event.type === "notes") {
    title = "Poznámka přidána";
  } else if (event.type === "next_step") {
    title = `Další krok: ${p.text ?? "nastaven"}`;
  } else if (event.type === "converted") {
    title = `Převedeno na deal${typeof p.purchasePrice === "number" ? ` (${formatPrice(p.purchasePrice)})` : ""}`;
  }

  const lostReasonLabel =
    event.type === "stage_changed" && typeof p.lostReason === "string"
      ? LOST_REASONS.find((r) => r.key === p.lostReason)?.label
      : null;

  return (
    <li className="relative flex items-start gap-2.5 pl-0">
      <span className={`relative z-10 mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full ${meta.color}`}>
        {meta.icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-foreground leading-snug break-words">{title}</p>
        <p className="text-[10px] text-muted/50 mt-0.5">
          {event.createdAt ? new Date(event.createdAt).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" }) : ""}
          {lostReasonLabel && <span className="text-red-400/80"> · {lostReasonLabel}</span>}
        </p>
      </div>
    </li>
  );
}
