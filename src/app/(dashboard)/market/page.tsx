"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
} from "lucide-react";

const localityData = [
  { name: "Praha 1", priceSqm: 145000, trend: "+5.2%", change: "up", listings: 23, daysOnMarket: 18 },
  { name: "Praha 2", priceSqm: 128000, trend: "+4.8%", change: "up", listings: 31, daysOnMarket: 22 },
  { name: "Praha 3", priceSqm: 112000, trend: "+6.1%", change: "up", listings: 45, daysOnMarket: 15 },
  { name: "Praha 4", priceSqm: 98000, trend: "+3.5%", change: "up", listings: 38, daysOnMarket: 25 },
  { name: "Praha 5", priceSqm: 105000, trend: "+4.2%", change: "up", listings: 42, daysOnMarket: 20 },
  { name: "Praha 8", priceSqm: 95000, trend: "+7.8%", change: "up", listings: 29, daysOnMarket: 14 },
  { name: "Brno – střed", priceSqm: 89000, trend: "+4.5%", change: "up", listings: 35, daysOnMarket: 21 },
  { name: "Brno – Královo Pole", priceSqm: 72000, trend: "+3.2%", change: "up", listings: 18, daysOnMarket: 28 },
  { name: "Ostrava – Poruba", priceSqm: 42000, trend: "+2.1%", change: "up", listings: 15, daysOnMarket: 35 },
  { name: "Liberec", priceSqm: 55000, trend: "-1.5%", change: "down", listings: 12, daysOnMarket: 42 },
];

const marketActivity = [
  { label: "Nové inzeráty dnes", value: "24" },
  { label: "Ø doba na trhu", value: "23 dní" },
  { label: "Inzerátů se sníženou cenou", value: "18 %" },
  { label: "Nejaktivnější portál", value: "sreality.cz" },
];

export default function MarketPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tržní analýzy</h1>
          <p className="text-muted text-sm mt-1">Přehled cen a trendů na realitním trhu</p>
        </div>
        <Button variant="glass" size="sm">
          <Download size={14} />
          Export PDF
        </Button>
      </div>

      {/* Market Activity */}
      <div className="grid gap-4 md:grid-cols-4">
        {marketActivity.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card glass>
              <CardContent className="p-4">
                <p className="text-xs text-muted">{item.label}</p>
                <p className="text-2xl font-bold mt-1">{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Locality Table */}
      <Card glass>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp size={16} className="text-secondary" />
            Ceny / m² podle lokality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted font-medium">Lokalita</th>
                  <th className="text-right py-3 px-2 text-muted font-medium">Ø cena/m²</th>
                  <th className="text-right py-3 px-2 text-muted font-medium">Trend</th>
                  <th className="text-right py-3 px-2 text-muted font-medium">Inzerátů</th>
                  <th className="text-right py-3 px-2 text-muted font-medium">Ø dní na trhu</th>
                </tr>
              </thead>
              <tbody>
                {localityData.map((loc) => (
                  <tr
                    key={loc.name}
                    className="border-b border-border hover:bg-card-hover transition-colors group"
                  >
                    <td className="py-3 px-2 font-medium">{loc.name}</td>
                    <td className="py-3 px-2 text-right">
                      {loc.priceSqm.toLocaleString()} Kč
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span
                        className={`flex items-center justify-end gap-1 ${
                          loc.change === "up" ? "text-success" : "text-danger"
                        }`}
                      >
                        {loc.change === "up" ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )}
                        {loc.trend}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">{loc.listings}</td>
                    <td className="py-3 px-2 text-right">{loc.daysOnMarket}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Seasonality */}
      <Card glass>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={16} className="text-warning" />
            Sezónnost – nejlepší období pro nákup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { month: "Leden–Únor", buy: "Výborné", desc: "Málo kupujících, motivovaní prodejci", color: "text-success" },
              { month: "Březen–Květen", buy: "Dobré", desc: "Rostoucí aktivita, více nabídek", color: "text-info" },
              { month: "Červen–Srpen", buy: "Průměrné", desc: "Nejvíc kupujících, vyšší ceny", color: "text-warning" },
              { month: "Září–Prosinec", buy: "Dobré", desc: "Pokles aktivity, prostor pro vyjednávání", color: "text-info" },
            ].map((season) => (
              <div key={season.month} className="p-3 rounded-lg bg-card-hover">
                <p className="text-sm font-medium">{season.month}</p>
                <p className={`text-sm font-semibold ${season.color}`}>{season.buy}</p>
                <p className="text-xs text-muted mt-1">{season.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
