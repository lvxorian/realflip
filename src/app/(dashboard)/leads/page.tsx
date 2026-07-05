"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Phone,
  MapPin,
  DollarSign,
  Plus,
  Filter,
  MoreHorizontal,
} from "lucide-react";

interface Lead {
  id: string;
  title: string;
  address: string;
  price: number;
  score: number;
  contact: string;
  lastActivity: string;
  stage: LeadStage;
}

type LeadStage = "new" | "contacted" | "meeting" | "offer" | "negotiation" | "won" | "lost";

const stages: { key: LeadStage; label: string; color: string }[] = [
  { key: "new", label: "Nový", color: "border-l-accent" },
  { key: "contacted", label: "Kontaktován", color: "border-l-info" },
  { key: "meeting", label: "Schůzka", color: "border-l-secondary" },
  { key: "offer", label: "Nabídka", color: "border-l-warning" },
  { key: "negotiation", label: "Vyjednávání", color: "border-l-orange-500" },
  { key: "won", label: "Uzavřeno", color: "border-l-success" },
  { key: "lost", label: "Ztraceno", color: "border-l-danger" },
];

const sampleLeads: Record<LeadStage, Lead[]> = {
  new: [
    { id: "1", title: "Byt 3+kk, Praha 8 – Karlín", address: "Sokolovská 123", price: 4890000, score: 82, contact: "Jan Novák", lastActivity: "před 2 h", stage: "new" },
    { id: "2", title: "Byt 2+kk, Ostrava – Poruba", address: "Hlavní 789", price: 2890000, score: 91, contact: "Petr Svoboda", lastActivity: "před 5 h", stage: "new" },
  ],
  contacted: [
    { id: "3", title: "Rodinný dům, Brno – Královo Pole", address: "Božetěchova 45", price: 7250000, score: 74, contact: "Marie Dvořáková", lastActivity: "včera", stage: "contacted" },
  ],
  meeting: [
    { id: "4", title: "Byt 1+kk, Praha 5 – Smíchov", address: "Radlická 55", price: 3450000, score: 68, contact: "Tomáš Černý", lastActivity: "před 3 dny", stage: "meeting" },
  ],
  offer: [],
  negotiation: [],
  won: [],
  lost: [],
};

export default function LeadsPage() {
  const [dragOver, setDragOver] = useState<LeadStage | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-muted text-sm mt-1">
            {Object.values(sampleLeads).flat().length} aktivních leadů
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter size={14} />
            Filtry
          </Button>
          <Button variant="glass" size="sm">
            <Plus size={14} />
            Přidat lead
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {stages.map((stage) => {
          const leads = sampleLeads[stage.key];
          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-72 rounded-xl border border-border bg-card/50 backdrop-blur-sm ${
                dragOver === stage.key ? "border-accent/50 bg-accent/5" : ""
              } transition-all duration-200`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage.key); }}
              onDragLeave={() => setDragOver(null)}
            >
              {/* Stage Header */}
              <div className={`p-3 border-b border-border ${stage.color} border-l-4 rounded-t-xl`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{stage.label}</h3>
                  <Badge variant="outline" size="sm">{leads.length}</Badge>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[200px]">
                {leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted">
                    <p className="text-xs">Přetáhněte lead sem</p>
                  </div>
                ) : (
                  leads.map((lead) => (
                    <motion.div
                      key={lead.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      draggable
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <Card glass className="hover:border-accent/30 transition-all duration-200">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium leading-tight">{lead.title}</p>
                            <button className="text-muted hover:text-foreground">
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted">
                            <MapPin size={12} />
                            <span>{lead.address}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-sm">
                              <DollarSign size={14} className="text-secondary" />
                              <span className="font-semibold">
                                {(lead.price / 1000000).toFixed(1)} mil.
                              </span>
                            </div>
                            <Badge
                              variant="score"
                              style={{
                                borderColor:
                                  lead.score >= 70
                                    ? "rgba(16, 185, 129, 0.3)"
                                    : lead.score >= 40
                                      ? "rgba(245, 158, 11, 0.3)"
                                      : "rgba(239, 68, 68, 0.3)",
                                color:
                                  lead.score >= 70
                                    ? "#10b981"
                                    : lead.score >= 40
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            >
                              {lead.score}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border">
                            <span>{lead.contact}</span>
                            <span>{lead.lastActivity}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
