"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PropertyCard } from "@/components/ui/property-card";
import { PropertyImage } from "@/components/ui/property-image";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { X, ArrowDown, CaretLeft, CaretRight, Star } from "@phosphor-icons/react/dist/ssr";
import {
  MagnifyingGlass,
  SquaresFour,
  List,
  FadersHorizontal,
  MapPin,
} from "@phosphor-icons/react";

const PAGE_SIZE = 48;

export interface PropertyListItem {
  id: string;
  title: string;
  price: number;
  removed?: boolean;
  removedAt?: number | null;
  pricePerSqm: number | null;
  area: number | null;
  rooms: string | null;
  address: string | null;
  score: number | null;
  recommendation: string | null;
  daysOnMarket: number;
  imageUrls: string[];
  portalName: string;
  altCount?: number;
  locationCity: string | null;
  verdictLevel: string | null;
  condition: string | null;
  roi: number | null;
  arv: number | null;
  renovationCost: number | null;
  netProfit: number | null;
  totalCost: number | null;
  undervaluationPct?: number | null;
  overpricingPct?: number | null;
  marketPriceMin?: number | null;
  marketPriceMax?: number | null;
  isAuction?: boolean;
}

type SortMode =
  | "newest"
  | "priceAsc"
  | "priceDesc"
  | "pricePerSqmAsc"
  | "pricePerSqmDesc"
  | "areaAsc"
  | "areaDesc"
  | "highestScore"
  | "mostUndervalued";

interface FilterState {
  city: string;
  portal: string;
  verdict: string;
  condition: string;
  scoreMin: string;
  scoreMax: string;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
}

const PORTAL_LABELS: Record<string, string> = {
  sreality: "Sreality",
  bezrealitky: "Bezrealitky",
  bazos: "Bazos",
  annonce: "Annonce",
  mmreality: "M&M Reality",
  "idnes-reality": "iDnes Reality",
  hyperreality: "Hyperreality",
  "reality-cz": "Reality.cz",
  remax: "RE/MAX",
  century21: "Century 21",
  portaldrazeb: "Portál dražeb",
  realitymat: "Realitymat.cz",
  realitymix: "RealityMIX",
};

const INITIAL_FILTERS: FilterState = {
  city: "",
  portal: "",
  verdict: "",
  condition: "",
  scoreMin: "",
  scoreMax: "",
  priceMin: "",
  priceMax: "",
  areaMin: "",
  areaMax: "",
};

const VERDICT_LABELS: Record<string, string> = {
  strongBuy: "Silně doporučit",
  buy: "Doporučit",
  consider: "Zvážit",
  dontBuy: "Nedoporučit",
  reject: "Zamítnout",
};

const CONDITION_LABELS: Record<string, string> = {
  original: "Původní",
  good: "Dobrý",
  renovated: "Po rekonstrukci",
  dilapidated: "Zchátralý",
  new: "Novostavba",
};

const fmtPrice = (v: number) =>
  new Intl.NumberFormat("cs-CZ", { style: "decimal", maximumFractionDigits: 0 }).format(v);

const compactKc = (v: number) => {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m >= 10 ? Math.round(m) : Number(m.toFixed(1)).toLocaleString("cs-CZ")} mil. Kč`;
  }
  return `${Math.round(v / 1_000)} tis. Kč`;
};

/** Seřadí podle hodnoty, záznamy s chybějící hodnotou vždy na konec. */
function sortBy(
  list: PropertyListItem[],
  pick: (p: PropertyListItem) => number | null,
  dir: 1 | -1
): PropertyListItem[] {
  return list
    .filter((p) => pick(p) != null)
    .sort((a, b) => dir * ((pick(a) as number) - (pick(b) as number)))
    .concat(list.filter((p) => pick(p) == null));
}

export function PropertiesExplorer({ items, favoritedIds = [] }: { items: PropertyListItem[]; favoritedIds?: string[] }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sort, setSort] = useState<SortMode>("newest");
  const [undervaluedOnly, setUndervaluedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(0);

  const cities = useMemo(() => {
    const set = new Set<string>();
    items.forEach((p) => { if (p.locationCity) set.add(p.locationCity); });
    return Array.from(set).sort();
  }, [items]);

  const portals = useMemo(() => {
    const set = new Set<string>();
    items.forEach((p) => { if (p.portalName) set.add(p.portalName); });
    return Array.from(set).sort();
  }, [items]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = items.filter((p) => {
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q)
      );
    }).filter((p) => {
      if (filters.city && p.locationCity !== filters.city) return false;
      if (filters.portal && p.portalName !== filters.portal) return false;
      if (filters.verdict && p.verdictLevel !== filters.verdict) return false;
      if (filters.condition && p.condition !== filters.condition) return false;
      if (filters.scoreMin && (p.score ?? 0) < parseInt(filters.scoreMin)) return false;
      if (filters.scoreMax && (p.score ?? 0) > parseInt(filters.scoreMax)) return false;
      if (filters.priceMin && p.price < parseInt(filters.priceMin)) return false;
      if (filters.priceMax && p.price > parseInt(filters.priceMax)) return false;
      if (filters.areaMin && (p.area ?? 0) < parseFloat(filters.areaMin)) return false;
      if (filters.areaMax && (p.area ?? 0) > parseFloat(filters.areaMax)) return false;
      if (undervaluedOnly && (p.undervaluationPct ?? 0) <= 0) return false;
      if (favoritesOnly && !favoritedIds.includes(p.id)) return false;
      return true;
    });

    if (sort === "mostUndervalued") {
      result = sortBy(result, (p) => p.undervaluationPct ?? null, -1);
    } else if (sort === "highestScore") {
      result = sortBy(result, (p) => p.score ?? null, -1);
    } else if (sort === "priceAsc") {
      result = sortBy(result, (p) => p.price, 1);
    } else if (sort === "priceDesc") {
      result = sortBy(result, (p) => p.price, -1);
    } else if (sort === "pricePerSqmAsc") {
      result = sortBy(result, (p) => p.pricePerSqm, 1);
    } else if (sort === "pricePerSqmDesc") {
      result = sortBy(result, (p) => p.pricePerSqm, -1);
    } else if (sort === "areaAsc") {
      result = sortBy(result, (p) => p.area, 1);
    } else if (sort === "areaDesc") {
      result = sortBy(result, (p) => p.area, -1);
    }

    return result;
  }, [items, search, filters, sort, undervaluedOnly, favoritesOnly, favoritedIds]);

  const clearFilter = (key: keyof FilterState) => {
    setFilter(key, "");
  };

  const clearRange = (minKey: keyof FilterState, maxKey: keyof FilterState) => {
    setFilters((prev) => ({ ...prev, [minKey]: "", [maxKey]: "" }));
    setPage(0);
  };

  const activeChips: { key: string; label: string; onClear: () => void }[] = [];
  if (filters.city) activeChips.push({ key: "city", label: `Město: ${filters.city}`, onClear: () => clearFilter("city") });
  if (filters.portal) activeChips.push({ key: "portal", label: `Portál: ${PORTAL_LABELS[filters.portal] || filters.portal}`, onClear: () => clearFilter("portal") });
  if (filters.verdict) activeChips.push({ key: "verdict", label: VERDICT_LABELS[filters.verdict] ?? filters.verdict, onClear: () => clearFilter("verdict") });
  if (filters.condition) activeChips.push({ key: "condition", label: CONDITION_LABELS[filters.condition] ?? filters.condition, onClear: () => clearFilter("condition") });
  if (filters.scoreMin || filters.scoreMax) {
    activeChips.push({
      key: "score",
      label: `Skóre ${filters.scoreMin || "0"}–${filters.scoreMax || "100"}`,
      onClear: () => clearRange("scoreMin", "scoreMax"),
    });
  }
  if (filters.priceMin || filters.priceMax) {
    activeChips.push({
      key: "price",
      label: `Cena ${compactKc(Number(filters.priceMin) || 0)}–${compactKc(Number(filters.priceMax) || 0)}`,
      onClear: () => clearRange("priceMin", "priceMax"),
    });
  }
  if (filters.areaMin || filters.areaMax) {
    activeChips.push({
      key: "area",
      label: `Plocha ${filters.areaMin || "0"}–${filters.areaMax || "∞"} m²`,
      onClear: () => clearRange("areaMin", "areaMax"),
    });
  }
  if (undervaluedOnly) activeChips.push({ key: "undervalued", label: "Podhodnocené", onClear: () => { setUndervaluedOnly(false); setPage(0); } });
  if (favoritesOnly) activeChips.push({ key: "favorites", label: "Oblíbené", onClear: () => { setFavoritesOnly(false); setPage(0); } });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const setFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSearch("");
    setSort("newest");
    setUndervaluedOnly(false);
    setFavoritesOnly(false);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nemovitosti</h1>
          <p className="text-sm text-muted mt-1">{filtered.length} z {items.length} inzerátů</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              weight="regular"
            />
            <Input
              placeholder="Hledat..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="h-9 pl-9 w-56"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortMode); setPage(0); }}
            className="h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            <option value="newest">Nejnovější</option>
            <option value="priceDesc">Nejdražší</option>
            <option value="priceAsc">Nejlevnější</option>
            <option value="pricePerSqmDesc">Nejvyšší cena za m²</option>
            <option value="pricePerSqmAsc">Nejnižší cena za m²</option>
            <option value="areaDesc">Největší plocha</option>
            <option value="areaAsc">Nejmenší plocha</option>
            <option value="highestScore">Nejvyšší skóre</option>
            <option value="mostUndervalued">Nejpodhodnocenější</option>
          </select>
          <button
            onClick={() => { setUndervaluedOnly(!undervaluedOnly); setPage(0); }}
          className={`inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
            undervaluedOnly
              ? "bg-success/10 text-success border-success/30"
              : "border-border/50 bg-card text-muted hover:text-foreground hover:bg-card-hover"
          }`}
        >
          <ArrowDown size={14} weight="bold" />
          Podhodnocené
        </button>
        {favoritedIds.length > 0 && (
          <button
            onClick={() => { setFavoritesOnly(!favoritesOnly); setPage(0); }}
            className={`inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
              favoritesOnly
                ? "bg-accent/10 text-accent border-accent/30"
                : "border-border/50 bg-card text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            <Star size={14} weight={favoritesOnly ? "fill" : "regular"} />
            Oblíbené
          </button>
        )}
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
              hasActiveFilters
                ? "bg-accent/10 text-accent border-accent/30"
                : "border-border/50 bg-card text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            <FadersHorizontal size={14} weight="bold" />
            Filtry
            {hasActiveFilters && (
              <span className="h-4 w-4 rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center">
                {Object.values(filters).filter((v) => v !== "").length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-tight uppercase text-muted">Rozšířené filtry</p>
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted hover:text-foreground flex items-center gap-1"
                >
                  <X size={12} weight="bold" />
                  Vymazat
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <select
                  value={filters.city}
                  onChange={(e) => setFilter("city", e.target.value)}
                  className="h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50"
                >
                  <option value="">Všechna města</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filters.portal}
                  onChange={(e) => setFilter("portal", e.target.value)}
                  className="h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50"
                >
                  <option value="">Všechny portály</option>
                  {portals.map((p) => (
                    <option key={p} value={p}>{PORTAL_LABELS[p] || p}</option>
                  ))}
                </select>
                <select
                  value={filters.verdict}
                  onChange={(e) => setFilter("verdict", e.target.value)}
                  className="h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50"
                >
                  <option value="">Všechny verdikty</option>
                  <option value="strongBuy">Silně doporučit</option>
                  <option value="buy">Doporučit</option>
                  <option value="consider">Zvážit</option>
                  <option value="dontBuy">Nedoporučit</option>
                  <option value="reject">Zamítnout</option>
                </select>
                <select
                  value={filters.condition}
                  onChange={(e) => setFilter("condition", e.target.value)}
                  className="h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50"
                >
                  <option value="">Všechny stavy</option>
                  <option value="original">Původní</option>
                  <option value="good">Dobrý</option>
                  <option value="renovated">Po rekonstrukci</option>
                  <option value="dilapidated">Zchátralý</option>
                  <option value="new">Novostavba</option>
                </select>
                <div className="flex items-center gap-1.5">
                  <input
                    placeholder="Skóre od"
                    value={filters.scoreMin}
                    onChange={(e) => setFilter("scoreMin", e.target.value)}
                    type="number"
                    min={0}
                    max={100}
                    className="h-9 w-full rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-muted">–</span>
                  <input
                    placeholder="Skóre do"
                    value={filters.scoreMax}
                    onChange={(e) => setFilter("scoreMax", e.target.value)}
                    type="number"
                    min={0}
                    max={100}
                    className="h-9 w-full rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="flex items-center gap-1.5">
                  <input
                    placeholder="Cena od"
                    value={filters.priceMin}
                    onChange={(e) => setFilter("priceMin", e.target.value)}
                    type="number"
                    className="h-9 w-full rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-muted">Kč</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    placeholder="Cena do"
                    value={filters.priceMax}
                    onChange={(e) => setFilter("priceMax", e.target.value)}
                    type="number"
                    className="h-9 w-full rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-muted">Kč</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    placeholder="Plocha od"
                    value={filters.areaMin}
                    onChange={(e) => setFilter("areaMin", e.target.value)}
                    type="number"
                    className="h-9 w-full rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-muted">m²</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    placeholder="Plocha do"
                    value={filters.areaMax}
                    onChange={(e) => setFilter("areaMax", e.target.value)}
                    type="number"
                    className="h-9 w-full rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-muted">m²</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onClear}
              title="Odebrat filtr"
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
            >
              {chip.label}
              <X size={10} weight="bold" />
            </button>
          ))}
        </div>
      )}

      {/* Pagination top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{filtered.length} inzerátů celkem</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="h-8 w-8 rounded-lg border border-border/50 bg-card flex items-center justify-center hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <CaretLeft size={14} weight="bold" />
            </button>
            <span className="font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 w-8 rounded-lg border border-border/50 bg-card flex items-center justify-center hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <CaretRight size={14} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
          <MapPin size={32} weight="duotone" className="text-muted/40 mx-auto mb-3" />
          <p className="text-sm text-muted">Žádné nemovitosti neodpovídají filtrům.</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-accent hover:underline mt-2">
              Vymazat filtry
            </button>
          )}
        </div>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {view === "grid" ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {paged.map((p, i) => (
                  <PropertyCard
                    key={p.id}
                    id={p.id}
                    title={p.title}
                    price={p.price}
                    pricePerSqm={p.pricePerSqm ?? undefined}
                    address={p.address ?? "Neznámá adresa"}
                    score={p.score ?? 0}
                    isFavorited={favoritedIds.includes(p.id)}
                    status={
                      p.removed
                        ? undefined
                        : p.recommendation === "buy"
                        ? "Doporučeno"
                        : p.daysOnMarket <= 2
                        ? "Nový"
                        : undefined
                    }
                    area={p.area ? `${p.area} m²` : undefined}
                    rooms={p.rooms ?? undefined}
                    days={p.daysOnMarket}
                    index={i}
                    imageUrl={p.imageUrls?.[0]}
                    imageUrls={p.imageUrls ?? []}
                    photoCount={p.imageUrls?.length ?? 0}
                    undervaluationPct={p.undervaluationPct ?? undefined}
                    isAuction={p.portalName === "portaldrazeb"}
                    removed={p.removed}
                    portalCount={p.altCount}
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
                {paged.map((p, i) => (
                  <Link key={p.id} href={`/properties/${p.id}`}>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 hover:bg-card-hover transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative h-14 w-20 shrink-0 rounded-lg overflow-hidden bg-card">
                        <PropertyImage
                          src={p.imageUrls?.[0]}
                          alt={p.title}
                          score={p.score}
                          removed={p.removed}
                          fit="cover"
                          containerClassName="h-full w-full"
                        />
                        <div className="absolute top-0.5 right-0.5">
                          <FavoriteButton propertyId={p.id} initialFavorited={favoritedIds.includes(p.id)} size={10} className="h-4 w-4" />
                        </div>
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
                        {p.altCount != null && p.altCount > 0 && (
                          <span className="text-[10px] text-muted/80 mt-0.5">
                            {p.altCount} portály
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold font-mono text-price">
                          {fmtPrice(p.price)}{" "}
                          Kč
                        </p>
                        {p.pricePerSqm != null && p.pricePerSqm > 0 && (
                          <p className="text-right text-[10px] text-muted font-mono mt-0.5">
                            {fmtPrice(p.pricePerSqm)} Kč/m²
                          </p>
                        )}
                        <div className="flex items-center gap-2 justify-end text-[11px] mt-0.5">
                          {p.roi != null && (
                            <span className={`font-mono font-semibold ${p.roi >= 15 ? "text-emerald-400" : p.roi >= 10 ? "text-amber-400" : "text-red-400"}`}>
                              ROI {p.roi.toFixed(1)}%
                            </span>
                          )}
                          {p.arv != null && p.arv > 0 && (
                            <span className="font-mono text-muted">ARV {fmtPrice(p.arv)} Kč</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination bottom */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted pt-4">
              <span>{filtered.length} inzerátů celkem</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="h-8 w-8 rounded-lg border border-border/50 bg-card flex items-center justify-center hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <CaretLeft size={14} weight="bold" />
                </button>
                <span className="font-mono">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-8 w-8 rounded-lg border border-border/50 bg-card flex items-center justify-center hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <CaretRight size={14} weight="bold" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
