"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, conditionLabel, buildingTypeLabel, occupancyLabel, locationCategoryLabel, portalLabel } from "@/lib/utils";
import {
  calculateFlipResults,
  calculateItemizedRenovation,
  renovationCostFromPreset,
} from "@/lib/analysis/flip-costs";
import { XCircle, Robot, CurrencyCircleDollar, Toolbox, Buildings, Phone, FloppyDisk, CaretDown, CaretUp } from "@phosphor-icons/react";

const verdictColors: Record<string, string> = {
  strongBuy: "success",
  buy: "success",
  consider: "warning",
  dontBuy: "danger",
  categoricalReject: "danger",
} as const;

const verdictLabels: Record<string, string> = {
  strongBuy: "Silný kandidát",
  buy: "Doporučeno",
  consider: "Zvážit",
  dontBuy: "Nedoporučeno",
  categoricalReject: "Zamítnout",
};

interface AnalysisResult {
  url: string;
  portal: string;
  success: boolean;
  error?: string;
  listing?: {
    id?: string;
    title: string;
    price: number;
    area: number | null;
    rooms: string | null;
    condition: string | null;
    address: string | null;
    description: string | null;
    imageUrls: string[];
    contactPhone: string | null;
    contactName: string | null;
    contactEmail: string | null;
  };
  analysis?: {
    pricePerSqm: number;
    marketPricePerSqmLow: number;
    marketPricePerSqmHigh: number;
    undervaluationPct: number;
    overpricingPct: number;
    investmentScore: number;
    verdictLevel: string;
    recommendation: string;
    verdictSummary: string | null;
    arv: number;
    roi: number;
    netProfit: number;
    targetPurchasePrice: number;
    priceReductionNeeded: number;
    priceReductionPct: number;
    condition: string | null;
    location: { city: string; category: string } | null;
    buildingType: string;
    segmentRating: string;
    occupancy: string;
    missingFields: string[];
    redFlags: { type: string; text: string; severity: string }[];
    scenarios: Record<string, {
      label: string;
      renovationCost: number;
      arv: number;
      totalCost: number;
      netProfit: number;
      roi: number;
    }>;
  };
  aiSummary?: string | null;
  aiNegotiationTips?: string[] | null;
  aiComparableNotes?: string | null;
  aiHiddenInfo?: string[] | null;
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } },
};

export default function InteractiveAnalysis({ result, index }: { result: AnalysisResult; index: number }) {
  if (!result.success) {
    return (
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-all">{result.url}</p>
                <p className="text-xs text-red-400 mt-1">{result.error ?? "Neznámá chyba"}</p>
                {result.portal && <Badge variant="secondary" size="sm" className="mt-2">{portalLabel(result.portal)}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return <InteractiveCard result={result} index={index} />;
}

function InteractiveCard({ result, index }: { result: AnalysisResult; index: number }) {
  const a = result.analysis!;
  const l = result.listing!;
  const area = l.area ?? 70;

  const [arv, setArv] = useState(a.arv);
  const [renovationMode, setRenovationMode] = useState<"preset" | "perSqm" | "total">("preset");
  const [renovationLevel, setRenovationLevel] = useState<"light" | "medium" | "full">("medium");
  const [renovationPerSqm, setRenovationPerSqm] = useState(Math.round(a.scenarios?.conservative?.renovationCost / area) || 10000);
  const [renovationTotal, setRenovationTotal] = useState(a.scenarios?.conservative?.renovationCost || 700000);
  const [targetRoi, setTargetRoi] = useState(15);

  const [costConfig, setCostConfig] = useState({
    sellCommission: true,
    appraisal: false,
    sourcingEnabled: false,
    sourcingFee: 100000,
    sourcingFeeIsPct: false,
    holdingMonths: 6,
    hasMortgage: false,
    mortgageAmount: 0,
    mortgageRate: 5,
  });

  const toggleConfig = (key: keyof typeof costConfig) =>
    setCostConfig((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateConfig = (key: keyof typeof costConfig, value: number) =>
    setCostConfig((prev) => ({ ...prev, [key]: value }));

  const [showPlanner, setShowPlanner] = useState(false);
  const [renovationItems, setRenovationItems] = useState(() => calculateItemizedRenovation(area, l.condition ?? null));

  const [comps, setComps] = useState<any[] | null>(null);
  const [compsStats, setCompsStats] = useState<any | null>(null);
  const [compsNote, setCompsNote] = useState<string | null>(null);
  const [compsDeadCount, setCompsDeadCount] = useState(0);
  const [loadingComps, setLoadingComps] = useState(false);

  const [negotiation, setNegotiation] = useState<any | null>(null);
  const [loadingNegotiation, setLoadingNegotiation] = useState(false);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [negotiationError, setNegotiationError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbSaved, setDbSaved] = useState(false);
  const [dbSavedMessage, setDbSavedMessage] = useState("");
  const [dbSavedId, setDbSavedId] = useState<string | null>(null);
  const [dbInitiateSaving, setDbInitiateSaving] = useState(false);

  const itemsTotal = useMemo(() => renovationItems.reduce((s, i) => s + i.estimatedCost, 0), [renovationItems]);

  const currentRenovation = useMemo(() => {
    if (renovationMode === "preset") return renovationCostFromPreset(area, renovationLevel);
    if (renovationMode === "perSqm") return Math.round(renovationPerSqm * area);
    if (renovationMode === "total") return itemsTotal;
    return renovationTotal;
  }, [renovationMode, renovationLevel, renovationPerSqm, renovationTotal, area, itemsTotal]);

  const flipResults = useMemo(() => {
    const adjusted = { ...costConfig, sourcingFee: costConfig.sourcingEnabled ? costConfig.sourcingFee : 0 };
    return calculateFlipResults(l.price, arv, currentRenovation, area, targetRoi, adjusted);
  }, [l.price, arv, currentRenovation, area, targetRoi, costConfig]);

  const targetFlipResults = useMemo(() => {
    const targetPrice = flipResults.targetPurchasePrice;
    if (targetPrice <= 0) return null;
    const adjusted = { ...costConfig, sourcingFee: costConfig.sourcingEnabled ? costConfig.sourcingFee : 0 };
    return calculateFlipResults(targetPrice, arv, currentRenovation, area, targetRoi, adjusted);
  }, [flipResults.targetPurchasePrice, arv, currentRenovation, area, targetRoi, costConfig]);

  const handleArvChange = (value: string) => {
    const num = parseInt(value.replace(/\s/g, "").replace(/Kč/g, "")) || 0;
    setArv(num);
  };

  const handleRenovationPerSqmChange = (value: string) => {
    const num = parseInt(value.replace(/\s/g, "")) || 0;
    setRenovationPerSqm(num);
  };

  const handleRenovationTotalChange = (value: string) => {
    const num = parseInt(value.replace(/\s/g, "").replace(/Kč/g, "")) || 0;
    setRenovationTotal(num);
  };

  const handleRoiChange = (value: string) => {
    const num = parseInt(value) || 0;
    setTargetRoi(Math.max(5, Math.min(50, num)));
  };

  const handleItemCostChange = (index: number, value: string) => {
    const num = parseInt(value.replace(/\s/g, "")) || 0;
    setRenovationItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], estimatedCost: num };
      const sum = next.reduce((s, i) => s + i.estimatedCost, 0);
      setRenovationTotal(sum);
      return next;
    });
    setRenovationMode("total");
  };

  const handlePresetChange = (level: "light" | "medium" | "full") => {
    setRenovationMode("preset");
    setRenovationLevel(level);
    const conditionMap: Record<string, string | null> = { light: "renovated", medium: "good", full: "original" };
    setRenovationItems(calculateItemizedRenovation(area, conditionMap[level]));
  };

  const loadComps = async () => {
    setLoadingComps(true);
    try {
      const res = await fetch("/api/analyze-url/comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: l.area,
          address: l.address,
          price: l.price,
          excludeUrl: result.url,
          city: a.location?.city,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComps(data.comps);
        setCompsStats(data.stats);
        setCompsNote(data.note ?? null);
        setCompsDeadCount(data.deadCount ?? 0);
      }
    } catch {}
    setLoadingComps(false);
  };

  const generateNegotiation = async () => {
    setLoadingNegotiation(true);
    setNegotiationError(null);
    try {
      const res = await fetch("/api/analyze-url/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: l.title,
          description: l.description,
          price: l.price,
          targetPrice: flipResults.targetPurchasePrice,
          arv,
          renovationCost: currentRenovation,
          area: l.area,
          rooms: l.rooms,
          condition: l.condition,
          address: l.address,
          pricePerSqm: a.pricePerSqm,
          costs: flipResults.costs,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNegotiationError(data?.error ?? "Chyba serveru — zkuste to prosím později");
        return;
      }
      if (data?.success) {
        setNegotiation(data);
        setShowNegotiation(true);
      } else {
        setNegotiationError(data.error ?? "Nepodařilo se vygenerovat scénář");
      }
    } catch (e) {
      setNegotiationError("Chyba sítě — zkontrolujte připojení");
    }
    setLoadingNegotiation(false);
  };

  const saveToDb = async () => {
    setDbSaving(true);
    try {
      const res = await fetch("/api/properties/create-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          portalName: result.portal,
          title: l.title,
          price: l.price,
          pricePerSqm: a.pricePerSqm,
          area: l.area,
          rooms: l.rooms,
          condition: l.condition,
          buildingType: a.buildingType,
          yearBuilt: null,
          address: l.address,
          lat: null,
          lng: null,
          description: l.description,
          imageUrls: l.imageUrls,
          contactName: l.contactName,
          contactPhone: l.contactPhone,
          contactEmail: l.contactEmail,
        }),
      });
      const data = await res.json();
      if (data.propertyId) {
        setDbSaved(true);
        setDbSavedId(data.propertyId);
        if (data.existed) setDbSavedMessage("Již v databázi ✅");
        else setDbSavedMessage("Uloženo ✅");
      }
    } catch {}
    setDbSaving(false);
  };

  const saveAndInitiate = async () => {
    setDbInitiateSaving(true);
    try {
      const res = await fetch("/api/properties/create-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          portalName: result.portal,
          title: l.title,
          price: l.price,
          pricePerSqm: a.pricePerSqm,
          area: l.area,
          rooms: l.rooms,
          condition: l.condition,
          buildingType: a.buildingType,
          yearBuilt: null,
          address: l.address,
          lat: null,
          lng: null,
          description: l.description,
          imageUrls: l.imageUrls,
          contactName: l.contactName,
          contactPhone: l.contactPhone,
          contactEmail: l.contactEmail,
        }),
      });
      const data = await res.json();
      if (data.propertyId) {
        const initRes = await fetch(`/api/properties/${data.propertyId}/initiate`, { method: "POST" });
        const initData = await initRes.json();
        if (initData.leadId) setSaved(true);
        setDbSaved(true);
        setDbSavedId(data.propertyId);
      }
    } catch {}
    setDbInitiateSaving(false);
  };

  const initiateNegotiation = async () => {
    const propertyId = l.id ?? dbSavedId;
    if (!propertyId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/initiate`, { method: "POST" });
      const data = await res.json();
      if (data.leadId) setSaved(true);
    } catch {}
    setSaving(false);
  };

  const verdictBadgeVariant = verdictColors[a.verdictLevel] ?? "secondary";
  const inputClass = "w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 text-right";

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardContent className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm leading-snug line-clamp-2 text-foreground">{l.title}</h3>
              <p className="text-xs text-muted mt-1 break-all">{result.url}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant={verdictBadgeVariant as any} size="sm">{verdictLabels[a.verdictLevel]}</Badge>
                <Badge variant="score" score={a.investmentScore} size="sm" />
                {l.condition && <span className="rounded-lg bg-card-hover border border-border/50 px-2 py-0.5 text-[10px] text-foreground/80">{conditionLabel(l.condition)}</span>}
                <span className="rounded-lg bg-card-hover border border-border/50 px-2 py-0.5 text-[10px] text-foreground/80">{portalLabel(result.portal)}</span>
              </div>
            </div>
          </div>

          {/* Image */}
          {l.imageUrls.length > 0 && (
            <div className="overflow-hidden rounded-xl">
              <img src={l.imageUrls[0]} alt={l.title} className="h-48 w-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBox label="Cena" value={formatPrice(l.price)} />
            <InfoBox label="ARV" value={formatPrice(arv)} highlight="text-price" />
            <InfoBox label="Cena za m²" value={formatPrice(a.pricePerSqm > 0 ? a.pricePerSqm : Math.round(l.price / area)) + "/m²"} />
            <InfoBox label="Trh/m²" value={`${formatPrice(a.marketPricePerSqmLow)}–${formatPrice(a.marketPricePerSqmHigh)}`} />
            <InfoBox label="ROI" value={flipResults.roi.toFixed(1) + "%"} highlight={flipResults.roi >= 15 ? "text-emerald-400" : flipResults.roi >= 10 ? "text-amber-400" : "text-red-400"} />
            <InfoBox label="Čistý zisk" value={formatPrice(flipResults.netProfit)} highlight="text-price" />
            <InfoBox label="Podhodnocení" value={a.undervaluationPct > 0 ? a.undervaluationPct.toFixed(1) + "%" : "—"} highlight={a.undervaluationPct > 0 ? "text-emerald-400" : "text-muted"} />
            <InfoBox label="Nadhodnocení" value={a.overpricingPct > 0 ? a.overpricingPct.toFixed(1) + "%" : "—"} highlight={a.overpricingPct > 0 ? "text-amber-400" : "text-muted"} />
          </div>

          {/* Location & Meta */}
          <div className="flex flex-wrap gap-2">
            {a.location && a.location.category !== "unknown" && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{a.location.city.charAt(0).toUpperCase() + a.location.city.slice(1)} ({locationCategoryLabel(a.location.category)})</span>}
            {l.area && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{l.area} m²</span>}
            {l.rooms && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{l.rooms}</span>}
            {l.address && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{l.address}</span>}
            {a.buildingType && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{buildingTypeLabel(a.buildingType)}</span>}
            {a.occupancy && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{occupancyLabel(a.occupancy)}</span>}
          </div>

          {/* ===== FEATURE 1: FLIP CALCULATOR ===== */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <CurrencyCircleDollar size={16} className="text-accent" />
              <h2 className="font-semibold tracking-tight text-sm">Kalkulačka flipu</h2>
            </div>

            {/* ARV */}
            <div>
              <label className="text-xs text-muted mb-1 block">ARV (hodnota po rekonstrukci)</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={formatPrice(arv) || "0"}
                    onChange={(e) => handleArvChange(e.target.value)}
                    className={inputClass}
                  />
                  <span className="text-[10px] text-muted mt-0.5 block text-right">celkem</span>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={l.area && l.area > 0 ? Math.round(arv / l.area).toLocaleString() : "—"}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\s/g, "")) || 0;
                      if (l.area && l.area > 0) setArv(num * l.area);
                    }}
                    className={inputClass}
                  />
                  <span className="text-[10px] text-muted mt-0.5 block text-right">Kč/m²</span>
                </div>
              </div>
            </div>

            {/* Renovation */}
            <div>
              <label className="text-xs text-muted mb-1.5 block">Náklady na rekonstrukci</label>
              <div className="flex gap-1.5 mb-2">
                {(["light", "medium", "full"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => handlePresetChange(level)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                      renovationMode === "preset" && renovationLevel === level
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border/50 text-muted hover:bg-card-hover"
                    }`}
                  >
                    {level === "light" ? "Lehká" : level === "medium" ? "Střední" : "Těžká"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex gap-1.5 text-xs text-muted">
                  <button onClick={() => setRenovationMode("perSqm")} className={`px-2 py-1 rounded border ${renovationMode === "perSqm" ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 hover:bg-card-hover"}`}>Kč/m²</button>
                  <button onClick={() => setRenovationMode("total")} className={`px-2 py-1 rounded border ${renovationMode === "total" ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 hover:bg-card-hover"}`}>Celkem</button>
                </div>
                {renovationMode === "perSqm" ? (
                  <input type="text" value={renovationPerSqm.toLocaleString()} onChange={(e) => handleRenovationPerSqmChange(e.target.value)} className={inputClass + " flex-1"} />
                ) : renovationMode === "total" ? (
                  <input type="text" value={formatPrice(renovationTotal) || "0"} onChange={(e) => handleRenovationTotalChange(e.target.value)} className={inputClass + " flex-1"} />
                ) : (
                  <span className="flex-1 text-right text-sm font-mono text-foreground">{formatPrice(currentRenovation)}</span>
                )}
              </div>
            </div>

            {/* Target ROI */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted shrink-0">Cílové ROI:</label>
              <input
                type="range"
                min={5}
                max={40}
                value={targetRoi}
                onChange={(e) => setTargetRoi(parseInt(e.target.value))}
                className="flex-1 accent-accent h-1.5"
              />
              <span className="text-sm font-mono text-foreground min-w-[3ch] text-right">{targetRoi}%</span>
            </div>

            {/* Cost Toggles */}
            <div className="rounded-xl bg-card border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Volitelné náklady</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.sellCommission} onChange={() => toggleConfig("sellCommission")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Provize RK prodejní (4 %)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.appraisal} onChange={() => toggleConfig("appraisal")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Znalecký posudek</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.sourcingEnabled} onChange={() => toggleConfig("sourcingEnabled")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Sourcing fee</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.hasMortgage} onChange={() => toggleConfig("hasMortgage")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Mám hypotéku</span>
                </label>
              </div>
              {costConfig.sourcingEnabled && (
                <div className="flex items-center gap-2 pl-6">
                  <input
                    type="number"
                    value={costConfig.sourcingFee || ""}
                    onChange={(e) => setCostConfig((prev) => ({ ...prev, sourcingFee: parseInt(e.target.value) || 0 }))}
                    className="w-24 rounded-lg border border-border/50 bg-card px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-accent/50"
                    placeholder="100000"
                  />
                  <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
                    <button
                      onClick={() => setCostConfig((prev) => ({ ...prev, sourcingFeeIsPct: false }))}
                      className={`px-2 py-1 transition-colors ${!costConfig.sourcingFeeIsPct ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                    >Kč</button>
                    <button
                      onClick={() => setCostConfig((prev) => ({ ...prev, sourcingFeeIsPct: true }))}
                      className={`px-2 py-1 transition-colors ${costConfig.sourcingFeeIsPct ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                    >%</button>
                  </div>
                </div>
              )}
              {costConfig.hasMortgage && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Výše úvěru</label>
                    <input
                      type="text"
                      value={costConfig.mortgageAmount > 0 ? costConfig.mortgageAmount.toLocaleString() : ""}
                      onChange={(e) => {
                        const num = parseInt(e.target.value.replace(/\s/g, "")) || 0;
                        updateConfig("mortgageAmount", num);
                      }}
                      placeholder="např. 3 000 000"
                      className="w-full rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Úroková sazba (%)</label>
                    <input
                      type="text"
                      value={costConfig.mortgageRate > 0 ? costConfig.mortgageRate.toString() : ""}
                      onChange={(e) => {
                        const num = parseFloat(e.target.value.replace(",", ".")) || 0;
                        updateConfig("mortgageRate", num);
                      }}
                      placeholder="např. 5"
                      className="w-full rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Target Price Highlight */}
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <p className="text-xs text-emerald-400 mb-1">🎯 IDEÁLNÍ KUPNÍ CENA</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono">{formatPrice(flipResults.targetPurchasePrice)}</p>
              <div className="flex items-center justify-center gap-3 mt-2 text-xs">
                <span className="text-muted">Aktuální: {formatPrice(l.price)}</span>
                <span className="text-red-400">↓ {formatPrice(flipResults.priceReductionNeeded)} ({flipResults.priceReductionPct}%)</span>
              </div>
            </div>

            {/* Cost Breakdown — at target price */}
            {targetFlipResults && (
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 overflow-hidden">
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400">
                  Výpočet při cílové ceně {formatPrice(flipResults.targetPurchasePrice)}
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { label: "Kupní cena", value: flipResults.targetPurchasePrice },
                      { label: "Právní služby", value: targetFlipResults.costs.legalFees },
                      ...(costConfig.appraisal ? [{ label: "Znalecký posudek", value: targetFlipResults.costs.appraisalFee }] : []),
                      { label: "Rekonstrukce", value: currentRenovation },
                      { label: "Rezerva 10 %", value: targetFlipResults.costs.contingency },
                      ...(costConfig.sellCommission ? [{ label: "Provize RK prodejní (4 %)", value: targetFlipResults.costs.sellingCommission }] : []),
                      ...(!costConfig.sellCommission && targetFlipResults.costs.marketingPhoto > 0 ? [{ label: "Marketing + foto", value: targetFlipResults.costs.marketingPhoto }] : []),
                      { label: `Provozní náklady (${costConfig.holdingMonths} měsíců)`, value: targetFlipResults.costs.holdingCosts },
                      ...(costConfig.hasMortgage && targetFlipResults.costs.mortgageCost > 0 ? [{ label: "Úrok z hypotéky", value: targetFlipResults.costs.mortgageCost }] : []),
                      ...(costConfig.sourcingEnabled && targetFlipResults.costs.sourcingFee > 0 ? [{ label: "Sourcing fee", value: targetFlipResults.costs.sourcingFee }] : []),
                      { label: "Daň z příjmu (15 %)", value: targetFlipResults.costs.incomeTax },
                    ].map((row) => (
                      <tr key={row.label} className="border-b border-emerald-500/10">
                        <td className="px-3 py-1.5 text-foreground/80">{row.label}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground">{formatPrice(row.value)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-500/10">
                      <td className="px-3 py-2 font-semibold text-emerald-400">Náklady celkem</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-400">{formatPrice(targetFlipResults.costs.totalCost)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="border-t border-emerald-500/20 px-3 py-2 text-xs space-y-1 bg-emerald-500/5">
                  <div className="flex justify-between">
                    <span className="text-emerald-400/70">ARV</span>
                    <span className="font-mono text-emerald-400">{formatPrice(arv)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400/70">Zisk</span>
                    <span className={`font-mono ${targetFlipResults.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatPrice(targetFlipResults.netProfit)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-emerald-400/70">ROI</span>
                    <span className={`font-mono ${targetFlipResults.roi >= 14.5 ? "text-emerald-400" : targetFlipResults.roi >= 10 ? "text-amber-400" : "text-red-400"}`}>{targetFlipResults.roi.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===== FEATURE 4: RENOVATION PLANNER ===== */}
          <div className="rounded-xl border border-border/50 p-4 space-y-3">
            <button onClick={() => setShowPlanner(!showPlanner)} className="flex items-center gap-2 w-full">
              <Toolbox size={16} className="text-muted" />
              <h2 className="font-semibold tracking-tight text-sm flex-1 text-left">Plán rekonstrukce</h2>
              {showPlanner ? <CaretUp size={14} className="text-muted" /> : <CaretDown size={14} className="text-muted" />}
            </button>
            {showPlanner && (
              <div className="space-y-1.5">
                {renovationItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 text-foreground/80">{item.category}</span>
                    <input
                      type="text"
                      value={item.estimatedCost.toLocaleString()}
                      onChange={(e) => handleItemCostChange(i, e.target.value)}
                      className="w-28 rounded border border-border/50 bg-card px-2 py-1 text-right font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
                    />
                    <span className="text-muted w-16 text-right">{Math.round(item.estimatedCost / area)} Kč/m²</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs pt-2 border-t border-border/30 font-semibold">
                  <span className="flex-1 text-foreground">Celkem</span>
                  <span className="w-28 text-right font-mono text-foreground">{formatPrice(renovationItems.reduce((s, i) => s + i.estimatedCost, 0))}</span>
                  <span className="text-muted w-16 text-right">{Math.round(renovationItems.reduce((s, i) => s + i.estimatedCost, 0) / area)} Kč/m²</span>
                </div>
              </div>
            )}
          </div>

          {/* ===== FEATURE 3: COMPS ===== */}
          <div className="rounded-xl border border-border/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Buildings size={16} className="text-muted" />
                <h2 className="font-semibold tracking-tight text-sm">Srovnání s trhem</h2>
              </div>
              {!comps && (
                <Button size="sm" variant="secondary" onClick={loadComps} disabled={loadingComps} className="text-xs">
                  {loadingComps ? "Načítám..." : "Načíst srovnání"}
                </Button>
              )}
            </div>
            {comps && compsStats && compsStats.count > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-card-hover border border-border/50 p-2 text-center">
                    <p className="text-muted">Počet</p>
                    <p className="font-mono font-semibold text-foreground">{compsStats.count}</p>
                  </div>
                  <div className="rounded-lg bg-card-hover border border-border/50 p-2 text-center">
                    <p className="text-muted">Medián ceny</p>
                    <p className="font-mono font-semibold text-foreground">{formatPrice(compsStats.medianPrice)}</p>
                  </div>
                  <div className="rounded-lg bg-card-hover border border-border/50 p-2 text-center">
                    <p className="text-muted">Medián Kč/m²</p>
                    <p className="font-mono font-semibold text-foreground">{formatPrice(compsStats.medianPricePerSqm)}</p>
                  </div>
                </div>
                {compsDeadCount > 0 && (
                  <p className="text-xs text-muted">{compsDeadCount} neaktivních inzerátů bylo odfiltrováno</p>
                )}
                <div className="text-xs text-muted">
                  Rozmezí: {formatPrice(compsStats.p25)} – {formatPrice(compsStats.p75)} (Q1–Q3)
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {comps.slice(0, 10).map((c: any) => (
                    <a key={c.id} href={c.url} target="_blank" className="flex items-center gap-2 rounded-lg bg-card-hover border border-border/30 p-2 text-xs hover:bg-card-hover/80 transition-colors">
                      {c.imageUrl && <img src={c.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" />}
                      <span className="flex-1 truncate text-foreground/80">{c.title}</span>
                      <span className="font-mono shrink-0">{formatPrice(c.price)}</span>
                      {c.area && <span className="text-muted shrink-0">{c.area}m²</span>}
                      {c.score && <Badge variant="score" score={c.score} size="sm" />}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {compsNote && !loadingComps && (
              <div className="rounded-lg bg-card-hover border border-border/50 p-3">
                <p className="text-xs text-muted">{compsNote}</p>
              </div>
            )}
          </div>

          {/* ===== FEATURE 2: AI NEGOTIATION ===== */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-amber-400" />
                <h2 className="font-semibold tracking-tight text-sm">Vyjednávací asistent</h2>
              </div>
              {!negotiation && (
                <Button size="sm" onClick={generateNegotiation} disabled={loadingNegotiation} className="text-xs">
                  {loadingNegotiation ? "Generuji..." : "Generovat scénář"}
                </Button>
              )}
            </div>
            {negotiationError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-xs text-red-400">{negotiationError}</p>
              </div>
            )}
            {negotiation && showNegotiation && (
              <div className="space-y-3">
                <div className="rounded-xl bg-card border border-border/50 p-3">
                  <p className="text-xs text-muted mb-1 font-medium">📞 Scénář hovoru</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{negotiation.phoneScript}</p>
                </div>
                {negotiation.openingLine && (
                  <div className="rounded-xl bg-accent/5 border border-accent/20 p-3">
                    <p className="text-xs text-muted mb-1 font-medium">🎯 První věta</p>
                    <p className="text-sm text-accent font-medium">{negotiation.openingLine}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {negotiation.maxStartingOffer && (
                    <div className="rounded-lg bg-card border border-border/50 p-2 text-center">
                      <p className="text-muted">Max. první nabídka</p>
                      <p className="font-mono font-semibold text-emerald-400">{formatPrice(negotiation.maxStartingOffer)}</p>
                    </div>
                  )}
                  {negotiation.walkAwayPrice && (
                    <div className="rounded-lg bg-card border border-border/50 p-2 text-center">
                      <p className="text-muted">Max. nabídka</p>
                      <p className="font-mono font-semibold text-red-400">{formatPrice(negotiation.walkAwayPrice)}</p>
                    </div>
                  )}
                </div>
                {negotiation.arguments?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-1.5 font-medium">💬 Argumenty pro snížení ceny</p>
                    <ul className="space-y-1">
                      {negotiation.arguments.map((arg: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {negotiation.sellerMotivation?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-1.5 font-medium">🔍 Motivace prodejce — jak odhalit</p>
                    <ul className="space-y-1">
                      {negotiation.sellerMotivation.map((tip: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-400/80">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {negotiation.handlingObjections?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-1.5 font-medium">🛡️ Jak reagovat na námitky</p>
                    <ul className="space-y-1">
                      {negotiation.handlingObjections.map((obj: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== FEATURE 7: SAVE & INITIATE ===== */}
          {l.id ? (
            <>
              {!saved && <Button onClick={initiateNegotiation} disabled={saving} className="w-full text-sm gap-2 h-11">{saving ? "Vytvářím..." : "Zahájit jednání"}</Button>}
              {saved && <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-center"><p className="text-sm text-emerald-400 font-medium">✅ Přidáno do pipeline</p></div>}
            </>
          ) : (
            <>
              <div className="flex gap-3">
                <Button onClick={saveToDb} disabled={dbSaving || dbSaved} variant={dbSaved ? "secondary" : "default"} className="flex-1 text-sm gap-2 h-11">
                  {dbSaving ? "Ukládám..." : dbSaved ? dbSavedMessage : "💾 Uložit do databáze"}
                </Button>
                <Button onClick={saveAndInitiate} disabled={dbInitiateSaving || saved} variant={saved ? "secondary" : "default"} className="flex-1 text-sm gap-2 h-11">
                  {dbInitiateSaving ? "Ukládám..." : saved ? "✅ V pipeline" : "🤝 Uložit a zahájit jednání"}
                </Button>
              </div>
              {(dbSaved || dbSavedId) && !saved && (
                <Button onClick={initiateNegotiation} disabled={saving} className="w-full text-sm gap-2 h-11 mt-2">
                  {saving ? "Vytvářím..." : "Zahájit jednání"}
                </Button>
              )}
            </>
          )}

          {/* Existing: AI Summary */}
          {result.aiSummary && (
            <div className="rounded-xl bg-card-hover border border-border/50 p-4">
              <p className="text-xs text-muted mb-3 font-medium">🤖 AI Hodnocení</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{result.aiSummary}</p>
            </div>
          )}

          {/* Existing: Red Flags */}
          {a.redFlags.length > 0 && (
            <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4">
              <h2 className="font-semibold tracking-tight text-sm text-red-400 mb-3">Varovné signály ({a.redFlags.length})</h2>
              <div className="space-y-2">
                {a.redFlags.map((rf, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-400/80">
                    <span className="mt-0.5 shrink-0">⚠</span>
                    <span>{rf.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="rounded-xl bg-card-hover border border-border/50 p-3">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-xs font-semibold font-mono whitespace-nowrap leading-snug ${highlight ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
