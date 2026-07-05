"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  FileText,
} from "lucide-react";

const projects = [
  {
    id: "1",
    title: "Byt 2+1, Praha 10 – Vršovice",
    address: "Krymská 45, Praha 10",
    purchasePrice: 4200000,
    estimatedArv: 6200000,
    renovationBudget: 1200000,
    renovationActual: 850000,
    status: "renovating",
    daysOwned: 45,
    progress: 70,
  },
  {
    id: "2",
    title: "Byt 1+kk, Brno – Veveří",
    address: "Lipová 12, Brno",
    purchasePrice: 3100000,
    estimatedArv: 4800000,
    renovationBudget: 900000,
    renovationActual: null,
    status: "purchased",
    daysOwned: 12,
    progress: 10,
  },
];

const completedDeals = [
  {
    id: "3",
    title: "Byt 3+kk, Praha 5 – Košíře",
    purchasePrice: 4800000,
    sellPrice: 7100000,
    profit: 1100000,
    roi: 18.2,
    duration: 8,
  },
  {
    id: "4",
    title: "Byt 2+kk, Brno – Černá Pole",
    purchasePrice: 3500000,
    sellPrice: 5100000,
    profit: 850000,
    roi: 16.5,
    duration: 6,
  },
];

export default function PortfolioPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted text-sm mt-1">
            2 aktivní projekty · 4 dokončené flipy
          </p>
        </div>
        <Button variant="glass" size="sm">
          <Plus size={14} />
          Nový projekt
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Aktivní projekty", value: "2", icon: Building2, color: "text-accent" },
          { label: "Celkový zisk", value: "3.2 mil. Kč", icon: DollarSign, color: "text-success" },
          { label: "Ø ROI", value: "17.2 %", icon: TrendingUp, color: "text-secondary" },
          { label: "Dokončené flipy", value: "4", icon: CheckCircle2, color: "text-info" },
        ].map((stat) => (
          <Card key={stat.label} glass>
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon size={20} className={stat.color} />
              <div>
                <p className="text-xs text-muted">{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Projects */}
      <h2 className="text-lg font-semibold">Aktivní projekty</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project, idx) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card
              glass
              className="cursor-pointer hover:border-accent/30 transition-all duration-200"
              onClick={() => router.push(`/portfolio/${project.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{project.title}</CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted mt-1">
                      <MapPin size={12} />
                      {project.address}
                    </div>
                  </div>
                  <Badge
                    variant={
                      project.status === "renovating"
                        ? "warning"
                        : project.status === "purchased"
                          ? "info"
                          : "success"
                    }
                  >
                    {project.status === "renovating" ? "Rekonstrukce" : "Koupeno"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Kupní cena</span>
                  <span className="font-semibold">
                    {(project.purchasePrice / 1000000).toFixed(1)} mil.
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">ARV</span>
                  <span className="font-semibold">
                    {(project.estimatedArv / 1000000).toFixed(1)} mil.
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Rozpočet rekonstrukce</span>
                  <span className="font-semibold">
                    {(project.renovationBudget / 1000000).toFixed(1)} mil.
                  </span>
                </div>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Průběh</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-card-hover overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-accent to-secondary"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Clock size={12} />
                  {project.daysOwned} dní od koupě
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Completed Deals */}
      <h2 className="text-lg font-semibold pt-4">Dokončené flipy</h2>
      <div className="space-y-2">
        {completedDeals.map((deal, idx) => (
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card glass className="hover:border-accent/30 transition-all duration-200">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20 border border-success/30">
                    <CheckCircle2 size={20} className="text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{deal.title}</p>
                    <p className="text-xs text-muted">{deal.duration} měsíců</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted">Nákup</p>
                    <p className="text-sm">
                      {(deal.purchasePrice / 1000000).toFixed(1)} mil.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Prodej</p>
                    <p className="text-sm">
                      {(deal.sellPrice / 1000000).toFixed(1)} mil.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Zisk</p>
                    <p className="text-sm font-semibold text-success">
                      {(deal.profit / 1000000).toFixed(1)} mil.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">ROI</p>
                    <Badge variant="success">{deal.roi.toFixed(1)}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
