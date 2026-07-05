"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { MarketChart } from "@/components/ui/market-chart";
import { ArrowUp, ArrowDown, Clock, SealCheck } from "@phosphor-icons/react";

const priceTrend = [
  { label: "Led", value: 82000 },
  { label: "Úno", value: 83500 },
  { label: "Bře", value: 86000 },
  { label: "Dub", value: 84500 },
  { label: "Kvě", value: 87800 },
  { label: "Čer", value: 89500 },
];

const localities = [
  { name: "Praha", price: 105000, trend: "up", change: "+3.2%", listings: 450, days: 22 },
  { name: "Brno", price: 82000, trend: "up", change: "+2.8%", listings: 230, days: 28 },
  { name: "Ostrava", price: 45000, trend: "down", change: "-1.5%", listings: 120, days: 35 },
  { name: "Plzeň", price: 58000, trend: "up", change: "+1.9%", listings: 85, days: 30 },
  { name: "Liberec", price: 52000, trend: "up", change: "+2.1%", listings: 62, days: 25 },
  { name: "Olomouc", price: 48000, trend: "down", change: "-0.8%", listings: 48, days: 32 },
  { name: "Č. Budějovice", price: 55000, trend: "up", change: "+1.4%", listings: 55, days: 29 },
  { name: "Hradec Králové", price: 60000, trend: "up", change: "+2.5%", listings: 42, days: 26 },
  { name: "Ústí n. Labem", price: 28000, trend: "down", change: "-3.1%", listings: 38, days: 45 },
  { name: "Pardubice", price: 54000, trend: "up", change: "+1.8%", listings: 36, days: 27 },
];

const recommendations = [
  { period: "Q1 2026", rating: "Výborné", note: "Nízká konkurence, motivovaní prodávající.", color: "text-emerald-400" },
  { period: "Q2 2026", rating: "Dobré", note: "Jarní oživení trhu, více inzerátů.", color: "text-accent" },
  { period: "Q3 2026", rating: "Průměrné", note: "Letní měsíce – pomalejší.", color: "text-amber-400" },
  { period: "Q4 2026", rating: "Dobré", note: "Předvánoční pokles poptávky.", color: "text-accent" },
];

const fmtPrice = (v: number) => `${(v / 1000).toFixed(0)}k`;

export default function MarketPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trh</h1>
        <p className="text-sm text-muted mt-1">Přehled realitního trhu v ČR</p>
      </div>

      {/* Activity stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Nové inzeráty", value: "24", sub: "dnes", icon: ArrowUp },
          { label: "Ø doba na trhu", value: "23", sub: "dní", icon: Clock },
          { label: "Snížené ceny", value: "18%", sub: "za týden", icon: ArrowDown },
          { label: "Nejaktivnější", value: "sreality.cz", sub: "47 inzerátů", icon: SealCheck },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border/50 bg-card p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted">{s.label}</span>
              <s.icon size={16} className="text-muted" weight="duotone" />
            </div>
            <p className="text-xl font-semibold font-mono tracking-tight">{s.value}</p>
            <p className="text-xs text-muted mt-1">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Price trend chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border/50 card-gradient-blue p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} weight="duotone" className="text-info" />
            <h2 className="font-semibold tracking-tight text-sm">Průměrná cena/m² (ČR)</h2>
          </div>
          <Badge variant="info" size="sm">+9.1% r/r</Badge>
        </div>
        <MarketChart
          data={priceTrend}
          accent="#3b82f6"
          height={200}
          formatValue={fmtPrice}
        />
      </motion.div>

      {/* Locality table */}
      <div>
        <h2 className="font-semibold tracking-tight mb-4">Ceny v lokalitách</h2>
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-4 text-xs text-muted font-medium">Lokalita</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Cena/m²</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Trend</th>
                  <th className="text-right p-4 text-xs text-muted font-medium hidden sm:table-cell">Inzerátů</th>
                  <th className="text-right p-4 text-xs text-muted font-medium hidden sm:table-cell">Dny na trhu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {localities.map((loc, i) => (
                  <motion.tr
                    key={loc.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-card-hover transition-colors"
                  >
                    <td className="p-4 font-medium">{loc.name}</td>
                    <td className="p-4 text-right font-mono">
                      {new Intl.NumberFormat("cs-CZ", { style: "decimal", maximumFractionDigits: 0 }).format(loc.price)} Kč
                    </td>
                    <td className="p-4 text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-mono ${loc.trend === "up" ? "text-emerald-400" : "text-red-400"}`}>
                        {loc.trend === "up" ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />}
                        {loc.change}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-muted hidden sm:table-cell">{loc.listings}</td>
                    <td className="p-4 text-right font-mono text-muted hidden sm:table-cell">{loc.days}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Seasonality */}
      <div>
        <h2 className="font-semibold tracking-tight mb-4">Sezónní doporučení</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendations.map((r, i) => (
            <motion.div
              key={r.period}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="rounded-2xl border border-border/50 bg-card p-5"
            >
              <p className="text-sm font-medium mb-1">{r.period}</p>
              <p className={`text-lg font-semibold font-mono ${r.color} mb-2`}>{r.rating}</p>
              <p className="text-xs text-muted">{r.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
