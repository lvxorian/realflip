"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { StatusDot } from "@/components/ui/status-dot";
import { ArrowRight, CurrencyDollar, ArrowUp, Folder, CheckCircle } from "@phosphor-icons/react";

const portfolioStats = [
  { label: "Aktivní projekty", value: 2, suffix: "", icon: Folder },
  { label: "Celkový zisk", value: 3200000, suffix: " Kč", format: true, prefix: "", icon: CurrencyDollar },
  { label: "Prům. ROI", value: 17.2, suffix: "%", decimals: 1, icon: ArrowUp, gauge: false },
  { label: "Dokončené flipy", value: 4, suffix: "", icon: CheckCircle },
];

const activeProjects = [
  { id: "1", title: "Byt 3+kk, Praha 8 – Karlín", purchasePrice: "4.890.000 Kč", arv: "6.200.000 Kč", renovation: 850000, spent: 320000, status: "Rekonstrukce", progress: 38, score: 82 },
  { id: "2", title: "Byt 2+1, Praha 4 – Nusle", purchasePrice: "4.200.000 Kč", arv: "5.100.000 Kč", renovation: 600000, spent: 0, status: "Koupeno", progress: 0, score: 56 },
];

const completedDeals = [
  { id: "d1", title: "Byt 2+kk, Ostrava – Poruba", profit: "+420.000 Kč", roi: "+18.2%", duration: "6 měsíců" },
  { id: "d2", title: "RD, Brno – Královo Pole", profit: "+680.000 Kč", roi: "+12.4%", duration: "8 měsíců" },
  { id: "d3", title: "Byt 1+kk, Praha 5 – Smíchov", profit: "+290.000 Kč", roi: "+9.8%", duration: "4 měsíce" },
  { id: "d4", title: "Byt 2+1, Brno – Štýřice", profit: "+510.000 Kč", roi: "+14.6%", duration: "7 měsíců" },
];

export default function PortfolioPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted mt-1">Přehled vašich investičních projektů</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {portfolioStats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border/50 bg-card p-5 relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted">{s.label}</span>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <s.icon size={16} weight="duotone" />
              </div>
            </div>
            <div className="text-2xl font-semibold font-mono">
              {s.prefix || ""}
              <CountUp
                end={s.value}
                suffix={s.suffix}
                decimals={s.decimals || 0}
                formatter={s.format ? (v: number) => (v / 1000000).toFixed(1) + "M" : undefined}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Active Projects */}
      <div>
        <h2 className="font-semibold tracking-tight mb-4">Aktivní projekty</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeProjects.map((p, i) => (
            <Link key={p.id} href={`/portfolio/${p.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover hover:border-accent/20 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold tracking-tight text-sm group-hover:text-accent transition-colors">{p.title}</h3>
                    <p className="text-xs text-muted mt-0.5">{p.purchasePrice}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ScoreGauge score={p.score} size={36} strokeWidth={2.5} />
                    <ArrowRight size={16} className="text-muted group-hover:text-accent transition-colors" weight="bold" />
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">{p.status}</span>
                    <span className="font-mono">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progress}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>ARV: {p.arv}</span>
                  <span className="w-0.5 h-0.5 rounded-full bg-border" />
                  <span>Reko: {p.renovation.toLocaleString()} Kč</span>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Completed Deals */}
      <div>
        <h2 className="font-semibold tracking-tight mb-4">Dokončené obchody</h2>
        <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/20 overflow-hidden">
          {completedDeals.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.04 }}
              className="flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <CheckCircle size={16} weight="fill" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted">{d.duration}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-emerald-400 font-mono">{d.profit}</p>
                <p className="text-xs text-muted font-mono">{d.roi}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
