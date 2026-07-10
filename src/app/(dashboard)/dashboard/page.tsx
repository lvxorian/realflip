"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CountUp } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { MarketChart } from "@/components/ui/market-chart";
import { StatusDot } from "@/components/ui/status-dot";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  House,
  TrendDown,
  CurrencyDollar,
  Star,
  ArrowRight,
  Phone,
  ChartLineUp,
  Buildings,
} from "@phosphor-icons/react";

interface DashboardData {
  totalProperties: number;
  todayProperties: number;
  avgUndervaluation: number;
  pipelineProfit: number;
  totalLeads: number;
  activeDeals: number;
  avgScore: number;
  topUndervalued: {
    id: string;
    title: string;
    price: number;
    score: number;
    undervaluationPct: number;
    rooms: string;
    area: number;
    imageUrls: string[];
    verdictLevel: string | null;
  }[];
  recentProperties: {
    id: string;
    title: string;
    price: number;
    score: number;
    rooms: string;
    area: number;
    status: string;
    days: number;
    imageUrls: string[];
  }[];
  activities: {
    id: string;
    text: string;
    time: string;
    type: string;
    status: "success" | "active" | "idle";
  }[];
  portfolioData: { label: string; value: number }[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 20 },
  },
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d: DashboardData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (status !== "authenticated" || loading) {
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

  const stats = [
    {
      label: "Sledované inzeráty",
      value: data?.totalProperties ?? 0,
      suffix: "",
      icon: House,
      color: "text-accent",
    },
    {
      label: "Prům. podhodnocení",
      value: data?.avgUndervaluation ?? 0,
      suffix: "%",
      decimals: 1,
      icon: TrendDown,
      color: "text-emerald-400",
    },
    {
      label: "Pipeline zisk",
      value: data?.pipelineProfit ?? 0,
      prefix: "",
      suffix: " Kč",
      format: true,
      icon: CurrencyDollar,
      color: "text-amber-400",
    },
    {
      label: "Investment Score",
      value: data?.avgScore ?? 0,
      suffix: "",
      icon: Star,
      color: "text-accent",
      gauge: true,
    },
  ];

  const recentProps = data?.recentProperties ?? [];
  const activities = data?.activities ?? [];
  const chartData = recentProps.length > 0
    ? recentProps
        .slice()
        .reverse()
        .map((p) => ({
          label: p.title.slice(0, 12) + "…",
          value: p.price,
        }))
    : [
        { label: "Led", value: 4200000 },
        { label: "Úno", value: 4800000 },
        { label: "Bře", value: 5100000 },
        { label: "Dub", value: 5400000 },
        { label: "Kvě", value: 5800000 },
        { label: "Čer", value: 6200000 },
      ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vítejte,{" "}
            {session?.user?.name?.split(" ")[0] || "investore"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {data?.todayProperties
              ? `${data.todayProperties} nových inzerátů dnes`
              : "Přehled vašich investic a tržní aktivity"}
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
                <span className="text-xs text-muted block">
                  {stat.label}
                </span>
                <div className="text-2xl font-semibold tracking-tight font-mono">
                  {stat.prefix || ""}
                  <CountUp
                    end={stat.value}
                    suffix={stat.suffix || ""}
                    decimals={stat.decimals || 0}
                    formatter={
                      stat.format
                        ? (v: number) =>
                            (v / 1000000).toFixed(1) + "M"
                        : undefined
                    }
                  />
                </div>
              </div>
              {stat.gauge ? (
                <ScoreGauge
                  score={stat.value}
                  size={44}
                  strokeWidth={3}
                />
              ) : (
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft ${stat.color}`}
                >
                  <stat.icon size={18} weight="duotone" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bento Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Chart */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 rounded-2xl border border-border/50 card-gradient-accent p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ChartLineUp
                size={16}
                weight="duotone"
                className="text-accent"
              />
              <h2 className="font-semibold tracking-tight text-sm">
                Ceny nemovitostí
              </h2>
            </div>
            <Badge variant="default" size="sm">
              {data?.totalProperties ?? 0} inzerátů
            </Badge>
          </div>
          <MarketChart
            data={chartData}
            accent="#10b981"
            height={180}
            formatValue={(v) =>
              `${(v / 1000000).toFixed(1)}M`
            }
          />
        </motion.div>

        {/* Right column */}
        <motion.div variants={itemVariants} className="space-y-4">
          {/* Call widget */}
          <div className="rounded-2xl border border-border/50 card-gradient-amber p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2">
                <Phone
                  size={14}
                  weight="duotone"
                  className="text-amber-400"
                />
                Call Mode
              </h2>
              <StatusDot
                status={data?.totalLeads ? "active" : "idle"}
              />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
                <Phone
                  size={24}
                  weight="fill"
                  className="text-amber-400"
                />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {data?.totalLeads
                    ? `${data.totalLeads} leadů v pipeline`
                    : "Žádné leady"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted mt-1">
                  <span className="flex items-center gap-1">
                    <span className="text-emerald-400 font-mono">
                      {data?.activeDeals ?? 0}
                    </span>{" "}
                    aktivních
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/leads"
              className="block w-full text-sm rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 py-2.5 hover:bg-amber-500/20 transition-colors font-medium text-center"
            >
              Spravovat leady
            </Link>
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h2 className="font-semibold tracking-tight text-sm mb-4">
              Aktivita
            </h2>
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
                      <StatusDot status={a.status} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground/80">
                        {a.text}
                      </p>
                      <p className="text-xs text-muted">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Buildings size={24} weight="duotone" />}
                title="Zatím žádná aktivita"
                description="Spusťte scrapování pro první inzeráty."
              />
            )}
          </div>
        </motion.div>
      </div>

      {/* Top Undervalued */}
      {data?.topUndervalued && data.topUndervalued.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold tracking-tight flex items-center gap-2">
              <TrendDown size={16} weight="duotone" className="text-emerald-400" />
              Nejpodhodnocenější
            </h2>
            <Link
              href="/properties?sort=mostUndervalued"
              className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
            >
              Všechny <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.topUndervalued.map((p, i) => (
              <Link key={p.id} href={`/properties/${p.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl border border-emerald-500/20 bg-card overflow-hidden hover:bg-card-hover hover:border-emerald-500/40 transition-all cursor-pointer group"
                >
                  <div className="relative h-28 overflow-hidden">
                    {p.imageUrls?.[0] ? (
                      <img
                        src={p.imageUrls[0]}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full property-image-shimmer flex items-center justify-center">
                        <ScoreGauge score={p.score} size={32} strokeWidth={2.5} />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge variant="success" size="sm">
                        -{p.undervaluationPct} %
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={
                          p.verdictLevel === "strongBuy" ? "success" :
                          p.verdictLevel === "buy" ? "default" :
                          "secondary"
                        }
                        size="sm"
                      >
                        {p.verdictLevel === "strongBuy" ? "Silně" :
                         p.verdictLevel === "buy" ? "Dop." :
                         p.verdictLevel === "consider" ? "Zvážit" : ""}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium truncate group-hover:text-accent transition-colors">
                      {p.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted mt-1">
                      <span>{p.area} m²</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-border" />
                      <span>{p.rooms}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-mono font-semibold text-price">
                        {new Intl.NumberFormat("cs-CZ", {
                          style: "decimal",
                          maximumFractionDigits: 0,
                        }).format(p.price)}{" "}
                        Kč
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Properties */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold tracking-tight">
            Nejnovější inzeráty
          </h2>
          <Link
            href="/properties"
            className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
          >
            Všechny <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
        {recentProps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentProps.map((p, i) => (
              <Link key={p.id} href={`/properties/${p.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="rounded-2xl border border-border/50 bg-card overflow-hidden hover:bg-card-hover hover:border-accent/20 transition-all cursor-pointer group"
                >
                  <div className="relative h-28 overflow-hidden">
                    {p.imageUrls?.[0] ? (
                      <img
                        src={p.imageUrls[0]}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full property-image-shimmer flex items-center justify-center">
                        <ScoreGauge score={p.score} size={32} strokeWidth={2.5} />
                      </div>
                    )}
                    <Badge
                      variant={
                        p.status === "Nový"
                          ? "success"
                          : p.status === "Cenový drop"
                          ? "warning"
                          : "default"
                      }
                      size="sm"
                      className="absolute top-2 right-2"
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium truncate group-hover:text-accent transition-colors">
                      {p.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted mt-1">
                      <span>{p.area} m²</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-border" />
                      <span>{p.rooms}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-border" />
                      <span>{p.days} dní</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-mono font-semibold text-price">
                        {new Intl.NumberFormat("cs-CZ", {
                          style: "decimal",
                          maximumFractionDigits: 0,
                        }).format(p.price)}{" "}
                        Kč
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Buildings size={24} weight="duotone" />}
            title="Žádné nemovitosti"
            description="Zatím nebyly naskriptovány žádné inzeráty."
          />
        )}
      </motion.div>
    </motion.div>
  );
}
