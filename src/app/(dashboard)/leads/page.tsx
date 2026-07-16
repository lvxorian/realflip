"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowsLeftRight, Check, X } from "@phosphor-icons/react";
import { formatRelative } from "@/lib/utils";

const stages = [
  { key: "new", label: "Nový", color: "border-l-accent" },
  { key: "contacted", label: "Kontaktován", color: "border-l-blue-500" },
  { key: "meeting", label: "Schůzka", color: "border-l-amber-500" },
  { key: "offer", label: "Nabídka", color: "border-l-emerald-500" },
  { key: "negotiation", label: "Vyjednávání", color: "border-l-emerald-400" },
  { key: "closed", label: "Uzavřeno", color: "border-l-emerald-600" },
  { key: "lost", label: "Ztraceno", color: "border-l-red-500" },
];

interface LeadItem {
  id: string;
  stage: string;
  priority: number | null;
  notes: string | null;
  updatedAt: number | null;
  propertyId: string | null;
  propertyTitle: string | null;
  propertyPrice: number | null;
  propertyArea: number | null;
  propertyRooms: string | null;
  contactName: string | null;
  contactPhone: string | null;
  analysisScore: number | null;
}

export default function LeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [convertPrice, setConvertPrice] = useState("");
  const [convertRenovation, setConvertRenovation] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d: LeadItem[]) => { if (Array.isArray(d)) setLeads(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const grouped: Record<string, LeadItem[]> = {};
  for (const stage of stages) grouped[stage.key] = [];
  for (const lead of leads) {
    if (grouped[lead.stage]) grouped[lead.stage].push(lead);
  }

  async function moveLead(leadId: string, fromStage: string, toStage: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: toStage } : l))
    );
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: toStage }),
    });
  }

  function handleDragStart(e: React.DragEvent, leadId: string, fromStage: string) {
    e.dataTransfer.setData("leadId", leadId);
    e.dataTransfer.setData("fromStage", fromStage);
  }

  function handleDrop(e: React.DragEvent, toStage: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    const fromStage = e.dataTransfer.getData("fromStage");
    setDragOver(null);
    if (fromStage && fromStage !== toStage) {
      moveLead(leadId, fromStage, toStage);
    }
  }

  async function convertToDeal(leadId: string) {
    const price = parseInt(convertPrice);
    if (!price) return;
    await fetch(`/api/leads/${leadId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchasePrice: price, renovationBudget: parseInt(convertRenovation) || null }),
    });
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setConverting(null);
  }

    if (status !== "authenticated" || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted mt-1">Načítání...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted mt-1">{leads.length} leadů napříč {stages.length} fázemi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7 gap-3 min-h-[70dvh]">
        {stages.map((stage) => {
          const stageLeads = grouped[stage.key] ?? [];
          const stageTotal = leads.length || 1;
          const pct = Math.round((stageLeads.length / stageTotal) * 100);

          return (
            <div
              key={stage.key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, stage.key)}
              className={`rounded-2xl border border-border/50 bg-card/50 flex flex-col transition-all duration-200 ${
                dragOver === stage.key ? "border-accent/40 bg-accent/5" : ""
              }`}
            >
              <div className="p-3 border-b border-border/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold tracking-tight">{stage.label}</span>
                  <span className="text-xs font-mono text-muted">{stageLeads.length}</span>
                </div>
                <div className="h-1 rounded-full bg-border/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    className={`h-full rounded-full ${stage.key === "lost" ? "bg-red-500/50" : "bg-accent/50"}`}
                  />
                </div>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                <AnimatePresence>
                  {stageLeads.length === 0 ? (
                    <EmptyState
                      icon={<ArrowsLeftRight size={18} weight="duotone" />}
                      title="Prázdná fáze"
                      description="Přetáhněte lead sem"
                      className="py-8"
                    />
                  ) : (
                    stageLeads.map((lead) => (
                      <div key={lead.id}>
                        {converting === lead.id ? (
                          <div className="rounded-xl border border-accent/40 bg-card p-3 space-y-2">
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
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => convertToDeal(lead.id)} className="text-xs">
                                <Check size={12} weight="bold" /> Převést
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setConverting(null)} className="text-xs">
                                <X size={12} weight="bold" /> Zrušit
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead.id, stage.key)}
                            className="rounded-xl border border-border/50 bg-card p-3 cursor-grab active:cursor-grabbing hover:bg-card-hover hover:border-accent/20 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium truncate">{lead.propertyTitle ?? "Neznámá nemovitost"}</span>
                              <ScoreGauge score={lead.analysisScore ?? 0} size={28} strokeWidth={2.5} showLabel={false} />
                            </div>
                            <p className="text-xs text-muted">{lead.propertyPrice ? `${lead.propertyPrice.toLocaleString()} Kč` : "—"}</p>
                            {lead.contactName && <p className="text-xs text-muted mt-1">{lead.contactName}</p>}
                            {lead.updatedAt && <p className="text-[10px] text-muted/50 mt-1">{formatRelative(lead.updatedAt)}</p>}
                            {stage.key === "closed" && (
                              <button
                                onClick={() => { setConverting(lead.id); setConvertPrice(lead.propertyPrice?.toString() ?? ""); setConvertRenovation(""); }}
                                className="mt-2 w-full rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-1.5 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                              >
                                Převést na deal
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
