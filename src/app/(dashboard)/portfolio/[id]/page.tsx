"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  CheckCircle,
  Clock,
  Pencil,
  UploadSimple,
  Trash,
  CurrencyDollar,
} from "@phosphor-icons/react";

export default function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const project = {
    id: params.id,
    title: "Byt 2+1, Praha 10 – Vršovice",
    address: "Krymská 45, Praha 10",
    purchasePrice: 4200000,
    estimatedArv: 6200000,
    renovationBudget: 1200000,
    renovationActual: 850000,
    status: "renovating",
    progress: 70,
    score: 78,
    renovationItems: [
      { category: "Bourání", planned: 80000, actual: 75000, notes: "Hotovo" },
      { category: "Elektrika", planned: 180000, actual: 165000, notes: "Hotovo" },
      { category: "Voda + topení", planned: 150000, actual: 140000, notes: "Hotovo" },
      { category: "Podlahy", planned: 120000, actual: 95000, notes: "Hotovo" },
      { category: "Kuchyně", planned: 250000, actual: 180000, notes: "Probíhá" },
      { category: "Koupelna", planned: 200000, actual: 120000, notes: "Probíhá" },
      { category: "Malby", planned: 60000, actual: 30000, notes: "Probíhá" },
      { category: "Okna", planned: 160000, actual: 45000, notes: "Zbývá" },
    ],
  };

  const totalPlanned = project.renovationItems.reduce((s, i) => s + i.planned, 0);
  const totalActual = project.renovationItems.reduce((s, i) => s + (i.actual || 0), 0);
  const remaining = totalPlanned - totalActual;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/portfolio")}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} weight="bold" />
        Zpět na portfolio
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-[2.5rem] border border-border/50 bg-card overflow-hidden">
              <div className="relative h-48 property-image-shimmer flex items-center justify-center">
                <ScoreGauge score={project.score} size={48} strokeWidth={3.5} />
                <Badge variant="warning" size="md" className="absolute top-4 right-4">Rekonstrukce</Badge>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight">{project.title}</h1>
                    <div className="flex items-center gap-1 text-sm text-muted mt-1">
                      <MapPin size={14} weight="bold" />
                      {project.address}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="flex items-center gap-4 py-4 mb-4">
                  {[
                    { label: "Koupeno", date: "20. 5. 2026", done: true },
                    { label: "Rekonstrukce", date: "Probíhá", done: true },
                    { label: "Prodej", date: "Q3 2026", done: false },
                  ].map((phase, i) => (
                    <div key={i} className="flex items-center gap-2 flex-1">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                        phase.done ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-card text-muted border-border/50"
                      }`}>
                        {phase.done ? <CheckCircle size={16} weight="fill" /> : <Clock size={16} weight="fill" />}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{phase.label}</p>
                        <p className="text-[10px] text-muted">{phase.date}</p>
                      </div>
                      {i < 2 && <div className="flex-1 h-px bg-border/50 mx-1" />}
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-xs text-muted">Kupní cena</p>
                    <p className="text-lg font-semibold font-mono">{(project.purchasePrice / 1000000).toFixed(1)} mil.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-xs text-muted">ARV</p>
                    <p className="text-lg font-semibold font-mono text-accent">{(project.estimatedArv / 1000000).toFixed(1)} mil.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-xs text-muted">Očekávaný zisk</p>
                    <p className="text-lg font-semibold font-mono text-emerald-400">
                      {((project.estimatedArv - project.purchasePrice - project.renovationBudget) / 1000000).toFixed(1)} mil.
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted">Celkový průběh</span>
                    <span className="font-semibold font-mono">{project.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-border/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress}%` }}
                      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Budget */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold tracking-tight text-sm">Rozpočet rekonstrukce</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400 font-mono">{((totalActual / totalPlanned) * 100).toFixed(0)}%</span>
                  <Badge variant="warning" size="sm">{remaining.toLocaleString()} Kč zbývá</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {project.renovationItems.map((item, i) => {
                  const pct = item.actual ? (item.actual / item.planned) * 100 : 0;
                  return (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-border/30 text-muted">
                            {item.notes}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-muted">{item.planned.toLocaleString()} Kč</span>
                          <span className={item.actual && item.actual <= item.planned ? "text-emerald-400" : "text-red-400"}>
                            {item.actual ? `${item.actual.toLocaleString()} Kč` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.8, delay: i * 0.03 }}
                          className={`h-full rounded-full ${pct <= 100 ? "bg-accent" : "bg-red-500"}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <h2 className="font-semibold tracking-tight text-sm mb-4">Akce</h2>
              <div className="space-y-2">
                <Button variant="glass" className="w-full justify-start gap-2" size="sm">
                  <Pencil size={14} weight="bold" />
                  Upravit projekt
                </Button>
                <Button variant="glass" className="w-full justify-start gap-2" size="sm">
                  <UploadSimple size={14} weight="bold" />
                  Nahrát dokument
                </Button>
                <Button variant="danger" className="w-full justify-start gap-2" size="sm">
                  <Trash size={14} weight="bold" />
                  Smazat projekt
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div className="rounded-2xl border border-border/50 card-gradient-accent p-5">
              <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2 mb-4">
                <CurrencyDollar size={16} className="text-accent" weight="duotone" />
                Finance
              </h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Nákup", value: `${(project.purchasePrice / 1000000).toFixed(1)} mil.` },
                  { label: "Rekonstrukce (plán)", value: `${(project.renovationBudget / 1000000).toFixed(1)} mil.` },
                  { label: "Rekonstrukce (aktuál)", value: `${(project.renovationActual / 1000000).toFixed(1)} mil.` },
                  { label: "ARV", value: `${(project.estimatedArv / 1000000).toFixed(1)} mil.`, color: "text-accent" },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-muted">{r.label}</span>
                    <span className={`font-mono font-medium ${r.color || ""}`}>{r.value}</span>
                  </div>
                ))}
                <div className="border-t border-border/30 pt-2 flex justify-between font-semibold">
                  <span>Očekávaný zisk</span>
                  <span className="text-emerald-400 font-mono">
                    {((project.estimatedArv - project.purchasePrice - project.renovationBudget) / 1000000).toFixed(1)} mil.
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
