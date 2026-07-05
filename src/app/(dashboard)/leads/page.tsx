"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowsLeftRight } from "@phosphor-icons/react";

const stages = [
  { key: "new", label: "Nový", color: "border-l-accent" },
  { key: "contacted", label: "Kontaktován", color: "border-l-blue-500" },
  { key: "meeting", label: "Schůzka", color: "border-l-amber-500" },
  { key: "offer", label: "Nabídka", color: "border-l-emerald-500" },
  { key: "negotiation", label: "Vyjednávání", color: "border-l-emerald-400" },
  { key: "closed", label: "Uzavřeno", color: "border-l-emerald-600" },
  { key: "lost", label: "Ztraceno", color: "border-l-red-500" },
];

const initialLeads: Record<string, any[]> = {
  new: [
    { id: "l1", title: "Byt 3+kk, Praha 8", price: "4.890.000 Kč", score: 82, contact: "Jan Novák", last: "před 2 h" },
    { id: "l2", title: "RD, Liberec", price: "4.980.000 Kč", score: 78, contact: "Petr Svoboda", last: "před 5 h" },
  ],
  contacted: [
    { id: "l3", title: "Byt 2+kk, Ostrava", price: "2.890.000 Kč", score: 91, contact: "Marie Dvořáková", last: "před 1 d" },
  ],
  meeting: [
    { id: "l4", title: "Byt 3+kk, Praha 8", price: "4.890.000 Kč", score: 82, contact: "Jan Novák", last: "před 3 d" },
  ],
  offer: [],
  negotiation: [],
  closed: [],
  lost: [],
};

export default function LeadsPage() {
  const [leads, setLeads] = useState(initialLeads);
  const [dragOver, setDragOver] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, leadId: string, fromStage: string) {
    e.dataTransfer.setData("leadId", leadId);
    e.dataTransfer.setData("fromStage", fromStage);
  }

  function handleDrop(e: React.DragEvent, toStage: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    const fromStage = e.dataTransfer.getData("fromStage");
    setDragOver(null);

    if (fromStage === toStage) return;

    const lead = leads[fromStage].find((l: any) => l.id === leadId);
    if (!lead) return;

    setLeads((prev) => ({
      ...prev,
      [fromStage]: prev[fromStage].filter((l: any) => l.id !== leadId),
      [toStage]: [...prev[toStage], lead],
    }));
  }

  const totalLeads = Object.values(leads).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted mt-1">{totalLeads} leadů napříč {stages.length} fázemi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7 gap-3 min-h-[70dvh]">
        {stages.map((stage) => {
          const stageLeads = leads[stage.key];
          const stageTotal = Object.values(leads).reduce((s, arr) => s + arr.length, 0);
          const pct = stageTotal > 0 ? Math.round((stageLeads.length / stageTotal) * 100) : 0;

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
              {/* Stage header */}
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

              {/* Cards */}
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
                    stageLeads.map((lead: any, i: number) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id, stage.key)}
                        className="rounded-xl border border-border/50 bg-card p-3 cursor-grab active:cursor-grabbing hover:bg-card-hover hover:border-accent/20 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium truncate">{lead.title}</span>
                          <ScoreGauge score={lead.score} size={28} strokeWidth={2.5} showLabel={false} />
                        </div>
                        <p className="text-xs text-muted">{lead.price}</p>
                        <p className="text-xs text-muted mt-1">{lead.contact}</p>
                        <p className="text-[10px] text-muted/50 mt-1">{lead.last}</p>
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
