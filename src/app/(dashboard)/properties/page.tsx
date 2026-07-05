"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TiltCard } from "@/components/ui/tilt-card";
import {
  Building2,
  MapPin,
  Search,
  SlidersHorizontal,
  Grid3X3,
  List,
  ChevronDown,
  TrendingUp,
  DollarSign,
  Maximize2,
} from "lucide-react";
import { motion } from "framer-motion";

const sampleProperties = [
  {
    id: "1",
    title: "Byt 3+kk, Praha 8 – Karlín",
    price: 4890000,
    pricePerSqm: 97800,
    area: 50,
    rooms: "3+kk",
    address: "Sokolovská 123, Praha 8",
    score: 82,
    status: "active",
    condition: "původní",
    daysOnMarket: 14,
    image: null,
  },
  {
    id: "2",
    title: "Rodinný dům, Brno – Královo Pole",
    price: 7250000,
    pricePerSqm: 72500,
    area: 100,
    rooms: "4+1",
    address: "Božetěchova 45, Brno",
    score: 74,
    status: "active",
    condition: "dobrý",
    daysOnMarket: 23,
    image: null,
  },
  {
    id: "3",
    title: "Byt 2+kk, Ostrava – Poruba",
    price: 2890000,
    pricePerSqm: 64200,
    area: 45,
    rooms: "2+kk",
    address: "Hlavní třída 789, Ostrava",
    score: 91,
    status: "active",
    condition: "po rekonstrukci",
    daysOnMarket: 5,
    image: null,
  },
  {
    id: "4",
    title: "Činžovní dům, Praha 3 – Žižkov",
    price: 12500000,
    pricePerSqm: 52100,
    area: 240,
    rooms: "6+2",
    address: "Jeseninova 22, Praha 3",
    score: 45,
    status: "active",
    condition: "původní",
    daysOnMarket: 67,
    image: null,
  },
  {
    id: "5",
    title: "Byt 1+kk, Praha 5 – Smíchov",
    price: 3450000,
    pricePerSqm: 115000,
    area: 30,
    rooms: "1+kk",
    address: "Radlická 55, Praha 5",
    score: 68,
    status: "active",
    condition: "dobrý",
    daysOnMarket: 8,
    image: null,
  },
  {
    id: "6",
    title: "Rodinný dům, Liberec – Vratislavice",
    price: 4980000,
    pricePerSqm: 46300,
    area: 95,
    rooms: "3+1",
    address: "U Skály 12, Liberec",
    score: 78,
    status: "active",
    condition: "původní",
    daysOnMarket: 31,
    image: null,
  },
  {
    id: "7",
    title: "Byt 2+1, Praha 4 – Nusle",
    price: 4200000,
    pricePerSqm: 84000,
    area: 50,
    rooms: "2+1",
    address: "Táborská 234, Praha 4",
    score: 56,
    status: "active",
    condition: "původní",
    daysOnMarket: 42,
    image: null,
  },
  {
    id: "8",
    title: "Byt 3+1, Brno – Štýřice",
    price: 5900000,
    pricePerSqm: 86800,
    area: 68,
    rooms: "3+1",
    address: "Vídeňská 67, Brno",
    score: 71,
    status: "active",
    condition: "dobrý",
    daysOnMarket: 11,
    image: null,
  },
];

export default function PropertiesPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");

  const filtered = sampleProperties.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nemovitosti</h1>
          <p className="text-muted text-sm mt-1">
            {filtered.length} aktivních inzerátů
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <SlidersHorizontal size={14} />
            Filtry
          </Button>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${
                viewMode === "grid"
                  ? "bg-accent/20 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-accent/20 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Hledat nemovitost..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1">
          Cena
          <ChevronDown size={14} />
        </Button>
        <Button variant="outline" size="sm" className="gap-1">
          Lokalita
          <ChevronDown size={14} />
        </Button>
        <Button variant="outline" size="sm" className="gap-1">
          Dispozice
          <ChevronDown size={14} />
        </Button>
        <Button variant="outline" size="sm" className="gap-1">
          Skóre
          <ChevronDown size={14} />
        </Button>
      </div>

      {/* Grid View */}
      {viewMode === "grid" ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filtered.map((prop) => (
            <motion.div
              key={prop.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <TiltCard tiltDegree={8} glare>
                <Card
                  glass
                  className="cursor-pointer group hover:border-accent/30 transition-all duration-200 h-full"
                  onClick={() => router.push(`/properties/${prop.id}`)}
                >
                  {/* Image placeholder */}
                  <div className="relative h-40 rounded-t-xl bg-gradient-to-br from-accent/10 to-secondary/5 flex items-center justify-center overflow-hidden">
                    <Building2 size={40} className="text-muted/30" />
                    <Badge
                      variant="score"
                      className="absolute top-3 right-3"
                      style={{
                        borderColor:
                          prop.score >= 70
                            ? "rgba(16, 185, 129, 0.3)"
                            : prop.score >= 40
                              ? "rgba(245, 158, 11, 0.3)"
                              : "rgba(239, 68, 68, 0.3)",
                        color:
                          prop.score >= 70
                            ? "#10b981"
                            : prop.score >= 40
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    >
                      {prop.score}
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-medium text-sm line-clamp-1 group-hover:text-accent transition-colors">
                      {prop.title}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <MapPin size={12} />
                      <span className="truncate">{prop.address}</span>
                    </div>
                    <div className="flex items-center gap-4 pt-1">
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign size={14} className="text-secondary" />
                        <span className="font-semibold">
                          {(prop.price / 1000000).toFixed(1)} mil.
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Maximize2 size={12} />
                        {prop.area} m²
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-xs text-muted">
                        {prop.rooms} · {prop.condition}
                      </span>
                      <span className="text-xs text-muted">
                        {prop.daysOnMarket} dní
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {filtered.map((prop, idx) => (
            <motion.div
              key={prop.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
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
                    <p className="font-medium truncate group-hover:text-accent transition-colors">
                      {prop.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <MapPin size={12} />
                        <span className="truncate">{prop.address}</span>
                      </div>
                      <span className="text-xs text-muted">·</span>
                      <span className="text-xs text-muted">{prop.daysOnMarket} dní na trhu</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">{prop.rooms}</p>
                      <p>dispozice</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">{prop.area}</p>
                      <p>m²</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{(prop.price / 1000000).toFixed(1)} mil. Kč</p>
                    <p className="text-xs text-muted">{prop.pricePerSqm.toLocaleString()} Kč/m²</p>
                  </div>
                  <Badge
                    variant="score"
                    style={{
                      borderColor:
                        prop.score >= 70
                          ? "rgba(16, 185, 129, 0.3)"
                          : prop.score >= 40
                            ? "rgba(245, 158, 11, 0.3)"
                            : "rgba(239, 68, 68, 0.3)",
                      color:
                        prop.score >= 70 ? "#10b981" : prop.score >= 40 ? "#f59e0b" : "#ef4444",
                    }}
                  >
                    {prop.score}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
