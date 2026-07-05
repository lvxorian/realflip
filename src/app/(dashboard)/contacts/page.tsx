"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MagnifyingGlass, Plus, Phone, Envelope } from "@phosphor-icons/react";

const contacts = [
  { id: "c1", name: "Jan Novák", phone: "+420 777 123 456", email: "jan.novak@reality.cz", type: "agent", tags: ["RE/MAX", "Praha"], deals: 4, score: 88 },
  { id: "c2", name: "Marie Dvořáková", phone: "+420 731 456 789", email: "marie@century21.cz", type: "agent", tags: ["Century21", "Brno"], deals: 2, score: 72 },
  { id: "c3", name: "Petr Svoboda", phone: "+420 602 987 654", type: "owner", tags: ["majitel", "Ostrava", "motivovaný"], deals: 1, score: 64 },
  { id: "c4", name: "Tomáš Černý", phone: "+420 605 111 222", email: "cerny@seznam.cz", type: "owner", tags: ["majitel", "Praha"], deals: 0, score: 45 },
  { id: "c5", name: "Eva Procházková", phone: "+420 777 888 999", email: "eva@realitypro.cz", type: "agent", tags: ["M&M Reality", "Liberec"], deals: 3, score: 81 },
];

export default function ContactsPage() {
  const [search, setSearch] = useState("");

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kontakty</h1>
          <p className="text-sm text-muted mt-1">{contacts.length} kontaktů</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Hledat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 w-56"
            />
          </div>
          <Button size="sm" variant="default" className="gap-1.5">
            <Plus size={14} weight="bold" />
            Přidat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, type: "spring" as const, stiffness: 100, damping: 20 }}
            className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover hover:border-accent/20 transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-mono font-medium">
                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm">{c.name}</h3>
                <Badge
                  variant={c.type === "agent" ? "default" : "secondary"}
                  size="sm"
                  className="mt-1"
                >
                  {c.type === "agent" ? "Makléř" : "Majitel"}
                </Badge>
              </div>
              <span className={`text-xs font-mono font-semibold ${
                c.score >= 80 ? "text-emerald-400" : c.score >= 60 ? "text-accent" : "text-muted"
              }`}>
                {c.score}
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted">
                <Phone size={12} weight="bold" />
                {c.phone}
              </div>
              {c.email && (
                <div className="flex items-center gap-2 text-muted truncate">
                  <Envelope size={12} weight="bold" />
                  {c.email}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {c.tags.map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/5 text-muted border border-border/30">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
              <span className="text-xs text-muted">{c.deals} obchody</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
