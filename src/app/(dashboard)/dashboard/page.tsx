"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CountUp } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { MarketChart } from "@/components/ui/market-chart";
import { StatusDot } from "@/components/ui/status-dot";
import { Badge } from "@/components/ui/badge";
import {
  House,
  TrendDown,
  CurrencyDollar,
  Star,
  ArrowRight,
  Phone,
  ChartLineUp,
} from "@phosphor-icons/react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } },
};

const stats = [
  { label: "Sledované inzeráty", value: 47, suffix: "", icon: House, color: "text-accent" },
  { label: "Prům. podhodnocení", value: 23.4, suffix: "%", decimals: 1, icon: TrendDown, color: "text-emerald-400" },
  { label: "Pipeline zisk", value: 2850000, prefix: "", suffix: " Kč", format: true, icon: CurrencyDollar, color: "text-amber-400" },
  { label: "Investment Score", value: 68, suffix: "", icon: Star, color: "text-accent", gauge: true },
];

const portfolioHistory = [
  { label: "Led", value: 4200000 },
  { label: "Úno", value: 4800000 },
  { label: "Bře", value: 5100000 },
  { label: "Dub", value: 5400000 },
  { label: "Kvě", value: 5800000 },
  { label: "Čer", value: 6200000 },
];

const recentProperties = [
  { id: "p1", title: "Byt 3+kk, Praha 8 – Karlín", price: 4890000, score: 82, change: "+19%", status: "Nový", rooms: "3+kk", area: "50 m²" },
  { id: "p2", title: "Byt 2+kk, Ostrava – Poruba", price: 2890000, score: 91, change: "+33%", status: "Nový", rooms: "2+kk", area: "45 m²" },
  { id: "p3", title: "RD, Brno – Královo Pole", price: 7250000, score: 74, change: "+12%", status: "Sledovaný", rooms: "4+1", area: "100 m²" },
  { id: "p4", title: "Byt 2+1, Praha 4 – Nusle", price: 4200000, score: 56, change: "+11%", status: "Cenový drop", rooms: "2+1", area: "55 m²" },
];

const activities = [
  { id: "a1", text: "Scraping sreality.cz dokončen", time: "47 inzerátů", type: "scraping", status: "success" as const },
  { id: "a2", text: "Nový inzerát – byt 2+kk, Praha 4", time: "před 12 min", type: "new", status: "active" as const },
  { id: "a3", text: "Snížení ceny o 150.000 Kč", time: "před 34 min", type: "price", status: "active" as const },
  { id: "a4", text: "Lead postoupen do fáze Schůzka", time: "před 1 h", type: "lead", status: "active" as const },
  { id: "a5", text: "Hovor s makléřem – domluvena prohlídka", time: "před 2 h", type: "call", status: "idle" as const },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status !== "authenticated" || !mounted) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vítejte, {session.user?.name?.split(" ")[0] || "investore"}
          </h1>
          <p className="text-sm text-muted mt-1">
            Přehled vašich investic a tržní aktivity
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <StatusDot status="active" />
          <span>Sledování aktivní</span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover transition-colors duration-300 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <span className="text-xs text-muted block">{stat.label}</span>
                <div className="text-2xl font-semibold tracking-tight font-mono">
                  {stat.prefix || ""}
                  <CountUp
                    end={stat.value}
                    suffix={stat.suffix || ""}
                    decimals={stat.decimals || 0}
                    formatter={stat.format ? (v: number) => (v / 1000000).toFixed(1) + "M" : undefined}
                  />
                </div>
              </div>
              {stat.gauge ? (
                <ScoreGauge score={stat.value} size={44} strokeWidth={3} />
              ) : (
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft ${stat.color}`}>
                  <stat.icon size={18} weight="duotone" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bento Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Chart — takes 2 cols */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 rounded-2xl border border-border/50 card-gradient-accent p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ChartLineUp size={16} weight="duotone" className="text-accent" />
              <h2 className="font-semibold tracking-tight text-sm">Vývoj portfolia</h2>
            </div>
            <Badge variant="default" size="sm">+47.6% tento rok</Badge>
          </div>
          <MarketChart
            data={portfolioHistory}
            accent="#10b981"
            height={180}
            formatValue={(v) => `${(v / 1000000).toFixed(1)}M`}
          />
        </motion.div>

        {/* Call widget — takes 1 col */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="rounded-2xl border border-border/50 card-gradient-amber p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2">
                <Phone size={14} weight="duotone" className="text-amber-400" />
                Call Mode
              </h2>
              <StatusDot status="active" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
                <Phone size={24} weight="fill" className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium">5 hovorů v plánu</p>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <span className="text-emerald-400 font-mono">3</span> hotovo
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="flex items-center gap-1">
                    <span className="text-amber-400 font-mono">67%</span> konverze
                  </span>
                </div>
              </div>
            </div>
            <button className="w-full text-sm rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 py-2.5 hover:bg-amber-500/20 transition-colors font-medium">
              Spustit Call Mode
            </button>
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h2 className="font-semibold tracking-tight text-sm mb-4">Aktivita</h2>
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
                    <StatusDot status={a.status} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground/80">{a.text}</p>
                    <p className="text-xs text-muted">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Properties */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold tracking-tight">Nejnovější inzeráty</h2>
          <button className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1">
            Všechny <ArrowRight size={12} weight="bold" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentProperties.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="rounded-2xl border border-border/50 bg-card overflow-hidden hover:bg-card-hover hover:border-accent/20 transition-all cursor-pointer group"
            >
              <div className="relative h-28 property-image-shimmer flex items-center justify-center">
                <ScoreGauge score={p.score} size={32} strokeWidth={2.5} />
                <Badge
                  variant={p.status === "Nový" ? "success" : p.status === "Cenový drop" ? "warning" : "default"}
                  size="sm"
                  className="absolute top-2 right-2"
                >
                  {p.status}
                </Badge>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium truncate group-hover:text-accent transition-colors">{p.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted mt-1">
                  <span>{p.area}</span>
                  <span className="w-0.5 h-0.5 rounded-full bg-border" />
                  <span>{p.rooms}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-mono font-semibold text-price">
                    {new Intl.NumberFormat("cs-CZ", { style: "decimal", maximumFractionDigits: 0 }).format(p.price)} Kč
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">{p.change}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
