"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Building2,
  TrendingUp,
  DollarSign,
  Target,
  Activity,
  Phone,
  MapPin,
  Bell,
} from "lucide-react";

const stats = [
  {
    title: "Sledované inzeráty",
    value: 47,
    suffix: "",
    icon: Building2,
    color: "text-accent",
    change: "+12 dnes",
  },
  {
    title: "Prům. podhodnocení",
    value: 23,
    suffix: "%",
    icon: TrendingUp,
    color: "text-secondary",
    change: "+3.2% oproti týdnu",
  },
  {
    title: "Pipeline zisk",
    value: 2850000,
    prefix: "",
    icon: DollarSign,
    color: "text-success",
    change: "z 8 aktivních leadů",
    formatter: (v: number) => `${(v / 1000000).toFixed(1)} mil. Kč`,
  },
  {
    title: "Investment Score",
    value: 68,
    suffix: "",
    icon: Target,
    color: "text-warning",
    change: "průměr napříč portfoliem",
  },
];

const recentProperties = [
  {
    id: "1",
    title: "Byt 3+kk, Praha 8 – Karlín",
    price: 4890000,
    score: 82,
    address: "Sokolovská 123, Praha 8",
    image: null,
  },
  {
    id: "2",
    title: "Rodinný dům, Brno – Královo Pole",
    price: 7250000,
    score: 74,
    address: "Božetěchova 45, Brno",
    image: null,
  },
  {
    id: "3",
    title: "Byt 2+kk, Ostrava – Poruba",
    price: 2890000,
    score: 91,
    address: "Hlavní třída 789, Ostrava",
    image: null,
  },
  {
    id: "4",
    title: "Činžovní dům, Praha 3 – Žižkov",
    price: 12500000,
    score: 45,
    address: "Jeseninova 22, Praha 3",
    image: null,
  },
];

const activities = [
  { type: "new", message: "Nalezen nový inzerát – byt 2+kk, Praha 4", time: "před 12 min" },
  { type: "price", message: "Snížení ceny o 150 000 Kč – byt 3+kk, Brno", time: "před 34 min" },
  { type: "lead", message: "Lead postoupen do fáze Schůzka – Praha 8", time: "před 1 h" },
  { type: "call", message: "Hovor s makléřem – domluvena prohlídka", time: "před 2 h" },
  { type: "scrape", message: "Scraping sreality.cz dokončen (47 inzerátů)", time: "před 3 h" },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            Vítejte zpět, {session?.user?.name || "investore"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="glass" size="sm">
            <Bell size={16} />
            3
          </Button>
          <Button variant="glass" size="sm">
            <Activity size={16} />
            Live Feed
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
        }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <Card glass className="hover:border-accent/30 transition-all duration-300 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted">
                    {stat.title}
                  </CardTitle>
                  <Icon size={18} className={stat.color} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <CountUp
                      end={stat.value}
                      suffix={stat.suffix}
                      formatter={stat.formatter}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">{stat.change}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Properties */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Nejnovější nemovitosti</h2>
          <div className="space-y-2">
            {recentProperties.map((prop, idx) => (
              <motion.div
                key={prop.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  glass
                  className="hover:border-accent/30 transition-all duration-200 cursor-pointer group"
                  onClick={() => router.push(`/properties/${prop.id}`)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-card-hover border border-border">
                      <Building2 size={22} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{prop.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin size={12} className="text-muted shrink-0" />
                        <span className="text-xs text-muted truncate">{prop.address}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {(prop.price / 1000000).toFixed(1)} mil. Kč
                      </p>
                      <Badge variant="score" className="mt-1" style={{
                        borderColor: prop.score >= 70 ? 'rgba(16, 185, 129, 0.3)' : prop.score >= 40 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                        color: prop.score >= 70 ? '#10b981' : prop.score >= 40 ? '#f59e0b' : '#ef4444',
                      }}>
                        Skóre {prop.score}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Column - Activity + Calls */}
        <div className="space-y-6">
          {/* Call widget */}
          <Card glass>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone size={16} className="text-secondary" />
                Dnešní hovory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Plánováno</span>
                <span className="font-semibold">5 hovorů</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Dokončeno</span>
                <span className="font-semibold">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Conversion rate</span>
                <span className="font-semibold text-success">67 %</span>
              </div>
              <Button variant="glass" className="w-full" size="sm" onClick={() => router.push("/call-mode")}>
                <Phone size={14} />
                Spustit Call Mode
              </Button>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card glass>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Aktivita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activities.map((act, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                    act.type === 'new' ? 'bg-accent' :
                    act.type === 'price' ? 'bg-success' :
                    act.type === 'lead' ? 'bg-warning' :
                    act.type === 'call' ? 'bg-secondary' : 'bg-muted'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{act.message}</p>
                    <p className="text-xs text-muted mt-0.5">{act.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
