"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import {
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Edit3,
  Upload,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const project = {
    id: params.id,
    title: "Byt 2+1, Praha 10 – Vršovice",
    address: "Krymská 45, Praha 10",
    purchasePrice: 4200000,
    purchaseDate: "2026-05-20",
    estimatedArv: 6200000,
    sellPrice: null,
    renovationBudget: 1200000,
    renovationActual: 850000,
    status: "renovating",
    daysOwned: 45,
    progress: 70,
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
        <ArrowLeft size={16} />
        Zpět na portfolio
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left - Main info */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card glass borderGradient>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{project.title}</CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted mt-1">
                      <MapPin size={14} />
                      {project.address}
                    </div>
                  </div>
                  <Badge variant="warning" size="lg">
                    Rekonstrukce
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Timeline */}
                <div className="flex items-center gap-4 py-3">
                  {[
                    { label: "Koupeno", date: "20. 5. 2026", done: true },
                    { label: "Rekonstrukce", date: "Probíhá", done: true },
                    { label: "Prodej", date: "Q3 2026", done: false },
                  ].map((phase, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-1">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                          phase.done
                            ? "bg-success/20 border-success/30 text-success"
                            : "bg-card-hover border-border text-muted"
                        }`}
                      >
                        {phase.done ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Clock size={16} />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{phase.label}</p>
                        <p className="text-[10px] text-muted">{phase.date}</p>
                      </div>
                      {idx < 2 && (
                        <div className="flex-1 h-px bg-border mx-2" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-card-hover">
                    <p className="text-xs text-muted">Kupní cena</p>
                    <p className="text-lg font-bold">
                      {(project.purchasePrice / 1000000).toFixed(1)} mil.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-card-hover">
                    <p className="text-xs text-muted">ARV</p>
                    <p className="text-lg font-bold text-secondary">
                      {(project.estimatedArv / 1000000).toFixed(1)} mil.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-card-hover">
                    <p className="text-xs text-muted">Očekávaný zisk</p>
                    <p className="text-lg font-bold text-success">
                      {((project.estimatedArv - project.purchasePrice - project.renovationBudget) / 1000000).toFixed(1)} mil.
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted">Celkový průběh</span>
                    <span className="font-semibold">{project.progress}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-card-hover overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-accent to-secondary"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Budget Breakdown */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Rozpočet rekonstrukce</span>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-success">{((totalActual / totalPlanned) * 100).toFixed(0)}% čerpáno</span>
                    <Badge variant="warning">{remaining.toLocaleString()} Kč zbývá</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.renovationItems.map((item, idx) => {
                  const pct = item.actual ? (item.actual / item.planned) * 100 : 0;
                  return (
                    <div key={idx} className="p-3 rounded-lg bg-card-hover space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-border text-muted">
                            {item.notes}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted">Plán: {(item.planned / 1000).toFixed(0)}k</span>
                          <span className={item.actual && item.actual <= item.planned ? "text-success" : "text-danger"}>
                            {(item.actual || 0) > 0 ? `Aktuálně: ${(item.actual / 1000).toFixed(0)}k` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-card overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.05 }}
                          className={`h-full rounded-full ${
                            pct <= 100 ? "bg-accent" : "bg-danger"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right - Actions */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base">Akce</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="glass" className="w-full justify-start" size="sm">
                  <Edit3 size={14} />
                  Upravit projekt
                </Button>
                <Button variant="glass" className="w-full justify-start" size="sm">
                  <Upload size={14} />
                  Nahrát dokument
                </Button>
                <Button variant="danger" className="w-full justify-start" size="sm">
                  <Trash2 size={14} />
                  Smazat projekt
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base">Finance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Nákup</span>
                  <span className="font-semibold">{(project.purchasePrice / 1000000).toFixed(1)} mil.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Rekonstrukce (plán)</span>
                  <span className="font-semibold">{(project.renovationBudget / 1000000).toFixed(1)} mil.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Rekonstrukce (aktuál)</span>
                  <span className="font-semibold">{(project.renovationActual / 1000000).toFixed(1)} mil.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">ARV</span>
                  <span className="font-semibold text-secondary">{(project.estimatedArv / 1000000).toFixed(1)} mil.</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Očekávaný zisk</span>
                  <span className="text-success">
                    {((project.estimatedArv - project.purchasePrice - project.renovationBudget) / 1000000).toFixed(1)} mil.
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
