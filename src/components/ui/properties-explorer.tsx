"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PropertyCard } from "@/components/ui/property-card";
import { Input } from "@/components/ui/input";
import {
  MagnifyingGlass,
  SquaresFour,
  List,
  FadersHorizontal,
  MapPin,
} from "@phosphor-icons/react";

export interface PropertyListItem {
  id: string;
  title: string;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  rooms: string | null;
  address: string | null;
  score: number | null;
  recommendation: string | null;
  daysOnMarket: number;
  imageUrls: string[];
}

const FILTERS = [
  { label: "Všechny", match: () => true },
  { label: "Nové", match: (p: PropertyListItem) => p.daysOnMarket <= 2 },
  { label: "Skóre 80+", match: (p: PropertyListItem) => (p.score ?? 0) >= 80 },
  { label: "Doporučeno", match: (p: PropertyListItem) => p.recommendation === "buy" },
  { label: "Zvažit", match: (p: PropertyListItem) => p.recommendation === "consider" },
] as const;

export function PropertiesExplorer({ items }: { items: PropertyListItem[] }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("Všechny");

  const filtered = useMemo(() => {
    const filterDef = FILTERS.find((f) => f.label === activeFilter) ?? FILTERS[0];
    const q = search.toLowerCase().trim();
    return items.filter((p) => {
      if (!filterDef.match(p)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, activeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nemovitosti</h1>
          <p className="text-sm text-muted mt-1">{filtered.length} aktivních inzerátů</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              weight="regular"
            />
            <Input
              placeholder="Hledat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 w-56"
            />
          </div>
          <div className="flex items-center rounded-lg border border-border/50 p-0.5 bg-card">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "grid" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              <SquaresFour size={16} weight={view === "grid" ? "fill" : "regular"} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "list" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              <List size={16} weight={view === "list" ? "fill" : "regular"} />
            </button>
          </div>
          <button className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-border/50 bg-card text-xs font-medium hover:bg-card-hover transition-colors">
            <FadersHorizontal size={14} weight="bold" />
            Filtry
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setActiveFilter(f.label)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              activeFilter === f.label
                ? "bg-accent/10 text-accent border-accent/30"
                : "border-border/50 text-muted hover:text-foreground hover:border-border bg-card"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
          <MapPin size={32} weight="duotone" className="text-muted/40 mx-auto mb-3" />
          <p className="text-sm text-muted">Žádné nemovitosti neodpovídají filtrům.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {view === "grid" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {filtered.map((p, i) => (
                <PropertyCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  price={p.price}
                  pricePerSqm={p.pricePerSqm ?? undefined}
                  address={p.address ?? "Neznámá adresa"}
                  score={p.score ?? 0}
                  status={
                    p.recommendation === "buy"
                      ? "Doporučeno"
                      : p.daysOnMarket <= 2
                      ? "Nový"
                      : undefined
                  }
                  area={p.area ? `${p.area} m²` : undefined}
                  rooms={p.rooms ?? undefined}
                  days={p.daysOnMarket}
                  index={i}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {filtered.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 hover:bg-card-hover transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative h-14 w-20 shrink-0 rounded-lg overflow-hidden bg-card">
                      {p.imageUrls && p.imageUrls.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrls[0]}
                          alt={p.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full property-image-shimmer flex items-center justify-center">
                          <span className="text-[10px] font-mono text-muted/40">
                            {p.score}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted">{p.address}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted mt-1">
                        {p.area && <span>{p.area} m²</span>}
                        {p.rooms && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{p.rooms}</span>
                          </>
                        )}
                        {p.daysOnMarket !== undefined && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{p.daysOnMarket} dní</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold font-mono text-price">
                        {new Intl.NumberFormat("cs-CZ", {
                          style: "decimal",
                          maximumFractionDigits: 0,
                        }).format(p.price)}{" "}
                        Kč
                      </p>
                      {p.pricePerSqm && (
                        <p className="text-[10px] text-muted">
                          {p.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
