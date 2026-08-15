"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropertyImage } from "@/components/ui/property-image";
import { formatPrice, conditionLabel, buildingTypeLabel, occupancyLabel, locationCategoryLabel, portalLabel } from "@/lib/utils";
import {
  calculateFlipResults,
  calculateItemizedRenovation,
  resolveRenovationCost,
} from "@/lib/analysis/flip-costs";
import { calculateRentalResults, estimateMonthlyRent, RENTAL_DEFAULTS, RENTAL_CONSTANTS, resolveSourcingFee, type RentalConfig } from "@/lib/analysis/rental-calc";
import { strategiesFromAvailability, type CooperationAvailability } from "@/lib/cooperation-models";
import { shiftFlipAtPrice, type CooperationView } from "@/lib/investor-portal-view";
import { XCircle, Robot, CurrencyCircleDollar, Toolbox, Buildings, Phone, FloppyDisk, CaretDown, CaretUp, Scales } from "@phosphor-icons/react";
import Link from "next/link";

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

const rentalVerdictColors: Record<string, "success" | "warning" | "danger"> = {
  rentalStrongBuy: "success",
  rentalBuy: "success",
  rentalConsider: "warning",
  rentalDontBuy: "danger",
};

function marketSourceInfo(analysis: { marketSource?: string | null; marketSampleSize?: number | null }) {
  if (!analysis.marketSource) return null;
  const labels: Record<string, string> = {
    db: "Vlastní data",
    sreality: "Živá data (sreality)",
    market_data: "Fixní tabulka",
    fallback: "Fallback",
  };
  const colors: Record<string, string> = {
    db: "text-emerald-400",
    sreality: "text-emerald-400",
    market_data: "text-amber-400",
    fallback: "text-red-400",
  };
  const label = labels[analysis.marketSource] ?? analysis.marketSource;
  const samples = analysis.marketSampleSize ? ` · ${analysis.marketSampleSize} vzorků` : "";
  return {
    text: analysis.marketSource === "sreality" || analysis.marketSource === "db" ? label + samples : label,
    className: colors[analysis.marketSource] ?? "",
  };
}

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
    arvPricePerSqmHigh: number;
    marketSource: string | null;
    marketSampleSize: number | null;
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

export default function InteractiveAnalysis({
  result,
  index,
  negotiatedPrice = null,
}: {
  result: AnalysisResult;
  index: number;
  negotiatedPrice?: number | null;
}) {
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

  return <InteractiveCard result={result} index={index} negotiatedPrice={negotiatedPrice} />;
}

function InteractiveCard({
  result,
  index,
  negotiatedPrice = null,
}: {
  result: AnalysisResult;
  index: number;
  negotiatedPrice?: number | null;
}) {
  const a = result.analysis!;
  const l = result.listing!;
  const area = l.area ?? 70;

  const [arv, setArv] = useState(a.arv);
  const [renovationMode, setRenovationMode] = useState<"preset" | "perSqm" | "total">("preset");
  const [renovationLevel, setRenovationLevel] = useState<"light" | "medium" | "full">("medium");
  const [renovationPerSqm, setRenovationPerSqm] = useState(Math.round(a.scenarios?.conservative?.renovationCost / area) || 12500);
  const [renovationTotal, setRenovationTotal] = useState(a.scenarios?.conservative?.renovationCost || 700000);
  const [targetRoi, setTargetRoi] = useState(15);

  const [flipStrategy, setFlipStrategy] = useState<CooperationAvailability>("both");

  const [costConfig, setCostConfig] = useState({
    sellCommission: false,
    appraisal: false,
    sourcingEnabled: true,
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
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetSaved, setPresetSaved] = useState(false);

  const currentRenovation = useMemo(
    () => resolveRenovationCost(renovationMode, renovationLevel, renovationPerSqm, renovationTotal, area),
    [renovationMode, renovationLevel, renovationPerSqm, renovationTotal, area]
  );

  /** Sourcing fee je součástí základu kalkulace vždy, když je zapnutý —
   *  ideální kupní cena se počítá se sourcing fee bez ohledu na nabízenou strategii.
   *  Strategie (Obojí/50/50/Sourcing fee) mění jen dostupnost pro portál. */
  const flipCostConfig = useMemo(
    () => ({ ...costConfig, sourcingFee: costConfig.sourcingEnabled ? costConfig.sourcingFee : 0 }),
    [costConfig]
  );

  const flipResults = useMemo(() => {
    return calculateFlipResults(l.price, arv, currentRenovation, area, targetRoi, flipCostConfig);
  }, [l.price, arv, currentRenovation, area, targetRoi, flipCostConfig]);

  const targetFlipResults = useMemo(() => {
    const targetPrice = flipResults.targetPurchasePrice;
    if (targetPrice <= 0) return null;
    return calculateFlipResults(targetPrice, arv, currentRenovation, area, targetRoi, flipCostConfig);
  }, [flipResults.targetPurchasePrice, arv, currentRenovation, area, targetRoi, flipCostConfig]);

  /** Zisk celého obchodu bez sourcing fee (základ pro 50/50) — při stejném kupním scénáři. */
  const targetFlipNoFee = useMemo(() => {
    if (!targetFlipResults) return null;
    const adjusted = { ...costConfig, sourcingEnabled: true, sourcingFee: 0 };
    return calculateFlipResults(targetFlipResults.targetPurchasePrice, arv, currentRenovation, area, targetRoi, adjusted);
  }, [targetFlipResults, arv, currentRenovation, area, targetRoi, costConfig]);

  /** Přepočet čísel spolupráce na potvrzenou vyjednanou cenu (co uvidí investor v portálu). */
  const negotiatedCoop = useMemo<CooperationView | null>(() => {
    if (negotiatedPrice == null || !targetFlipNoFee || !targetFlipResults) return null;
    const base: CooperationView = {
      availableStrategies: strategiesFromAvailability(flipStrategy),
      netProfitTotal: targetFlipNoFee.netProfit,
      investorProfitFiftyFifty: Math.round(targetFlipNoFee.netProfit / 2),
      investorProfitSourcing: targetFlipResults.netProfit,
      sourcingFee: targetFlipResults.costs.sourcingFee,
    };
    const shifted = shiftFlipAtPrice(base, negotiatedPrice, targetFlipResults.targetPurchasePrice);
    return shifted === base ? null : shifted;
  }, [negotiatedPrice, targetFlipNoFee, targetFlipResults, flipStrategy]);

  const [mode, setMode] = useState<"flip" | "rental">("flip");
  const [rentalConfig, setRentalConfig] = useState<RentalConfig>(() => ({
    ...RENTAL_DEFAULTS,
    monthlyRent: estimateMonthlyRent(area, a.location?.city ?? null, a.location?.category ?? null),
  }));

  const updateRental = (key: keyof RentalConfig, value: number | boolean) =>
    setRentalConfig((prev) => ({ ...prev, [key]: value }));

  const toggleRental = (key: keyof RentalConfig) =>
    setRentalConfig((prev) => ({ ...prev, [key]: !prev[key] }));

  const [rentalRenovationMode, setRentalRenovationMode] = useState<"preset" | "perSqm" | "total">("preset");
  const [rentalRenovationLevel, setRentalRenovationLevel] = useState<"light" | "medium" | "full">("medium");
  const [rentalRenovationPerSqm, setRentalRenovationPerSqm] = useState(Math.round(a.scenarios?.conservative?.renovationCost / area) || 12500);
  const [rentalRenovationTotal, setRentalRenovationTotal] = useState(a.scenarios?.conservative?.renovationCost || 700000);

  const rentalRenovationCost = useMemo(
    () => resolveRenovationCost(rentalRenovationMode, rentalRenovationLevel, rentalRenovationPerSqm, rentalRenovationTotal, area),
    [rentalRenovationMode, rentalRenovationLevel, rentalRenovationPerSqm, rentalRenovationTotal, area]
  );

  const rentalResults = useMemo(() => {
    const cfg = {
      ...rentalConfig,
      monthlyRent: rentalConfig.monthlyRent || estimateMonthlyRent(area, a.location?.city ?? null, a.location?.category ?? null),
    };
    return calculateRentalResults(l.price, area, rentalRenovationCost, cfg);
  }, [rentalConfig, l.price, area, rentalRenovationCost, a.location?.city, a.location?.category]);

  const targetRentalResults = useMemo(() => {
    const tp = rentalResults.targetPurchasePrice;
    if (tp <= 0) return null;
    const cfg = {
      ...rentalConfig,
      monthlyRent: rentalConfig.monthlyRent || estimateMonthlyRent(area, a.location?.city ?? null, a.location?.category ?? null),
    };
    return calculateRentalResults(tp, area, rentalRenovationCost, cfg);
  }, [rentalResults.targetPurchasePrice, area, rentalRenovationCost, rentalConfig, a.location?.city, a.location?.category]);

  const propertyId = l.id ?? dbSavedId;
  useEffect(() => {
    if (!propertyId) return;
    try {
      localStorage.setItem(`report-config-${propertyId}`, JSON.stringify({
        arv,
        renovationCost: currentRenovation,
        targetRoi,
        costConfig,
        flipStrategy,
        mode,
        rental: rentalConfig,
        renovationMode,
        renovationLevel,
        renovationPerSqm,
        renovationItems,
        rentalRenovationMode,
        rentalRenovationLevel,
        rentalRenovationPerSqm,
        rentalRenovationTotal,
      }));
    } catch {}
  }, [propertyId, arv, currentRenovation, targetRoi, costConfig, flipStrategy, mode, rentalConfig, renovationMode, renovationLevel, renovationPerSqm, renovationItems, rentalRenovationMode, rentalRenovationLevel, rentalRenovationPerSqm, rentalRenovationTotal]);

  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/properties/${propertyId}/calc-preset`).then((r) => r.json()).then((data) => {
      if (data?.preset) {
        setArv(data.preset.arv ?? arv);
        setTargetRoi(data.preset.targetRoi ?? targetRoi);
        if (data.preset.mode === "rental" || data.preset.mode === "flip") setMode(data.preset.mode);
        if (data.preset.renovationCost != null) setRenovationTotal(data.preset.renovationCost);
        const cfg = data.preset.config;
        if (cfg) {
          setCostConfig({
            ...costConfig,
            ...cfg,
            // Legacy presety neměly fee checkbox UI — false se starým fee > 0
            // znamenalo „fee je aktivní", takže se při načtení zapne.
            sourcingEnabled:
              typeof cfg.sourcingEnabled === "boolean"
                ? cfg.sourcingEnabled || (typeof cfg.sourcingFee === "number" && cfg.sourcingFee > 0)
                : true,
          });
          if (cfg.flipStrategy === "fifty-fifty" || cfg.flipStrategy === "sourcing-fee" || cfg.flipStrategy === "both") {
            setFlipStrategy(cfg.flipStrategy);
            // Pravidlo kalkulačky: fee za zprostředkování platí vždy kromě 50/50.
            if (cfg.flipStrategy === "fifty-fifty") {
              setCostConfig((prev) => ({ ...prev, sourcingEnabled: false }));
            } else if (!(typeof cfg.sourcingEnabled === "boolean" && !cfg.sourcingEnabled && cfg.sourcingFee === 0)) {
              setCostConfig((prev) => ({ ...prev, sourcingEnabled: true }));
            }
          }
          if (cfg.rental) setRentalConfig({ ...RENTAL_DEFAULTS, ...cfg.rental });
          if (cfg.renovationMode) setRenovationMode(cfg.renovationMode);
          if (cfg.renovationLevel) setRenovationLevel(cfg.renovationLevel);
          if (cfg.renovationPerSqm) setRenovationPerSqm(cfg.renovationPerSqm);
          if (cfg.renovationItems) setRenovationItems(cfg.renovationItems);
          if (cfg.rentalRenovationMode) setRentalRenovationMode(cfg.rentalRenovationMode);
          if (cfg.rentalRenovationLevel) setRentalRenovationLevel(cfg.rentalRenovationLevel);
          if (cfg.rentalRenovationPerSqm) setRentalRenovationPerSqm(cfg.rentalRenovationPerSqm);
          if (cfg.rentalRenovationTotal != null) setRentalRenovationTotal(cfg.rentalRenovationTotal);
        }
        localStorage.setItem(`report-config-${propertyId}`, JSON.stringify(data.preset));
      }
    }).catch(() => {});
  }, [propertyId]);

  const savePreset = async () => {
    if (!propertyId) return;
    setPresetSaving(true);
    const preset = {
      arv, renovationCost: currentRenovation, targetRoi, costConfig, flipStrategy, mode, rental: rentalConfig,
      renovationMode, renovationLevel, renovationPerSqm, renovationItems,
      rentalRenovationMode, rentalRenovationLevel, rentalRenovationPerSqm, rentalRenovationTotal,
      purchasePriceUsed:
        mode === "rental"
          ? (targetRentalResults?.targetPurchasePrice ?? rentalResults.targetPurchasePrice)
          : (targetFlipResults?.targetPurchasePrice ?? flipResults.targetPurchasePrice),
    };
    try {
      localStorage.setItem(`report-config-${propertyId}`, JSON.stringify(preset));
      const targetFlip = targetFlipResults ?? flipResults;
      const targetRental = targetRentalResults ?? rentalResults;
      await fetch(`/api/properties/${propertyId}/calc-preset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...preset,
          rentalNetYield: mode === "rental" ? targetRental.netYield : null,
          rentalGrossYield: mode === "rental" ? targetRental.grossYield : null,
          rentalNetYieldAfterTax: mode === "rental" ? targetRental.netYieldAfterTax : null,
          rentalCapRate: mode === "rental" ? targetRental.capRate : null,
          rentalCashFlowMonthly: mode === "rental" ? targetRental.cashFlowMonthly : null,
          rentalTotalInvested: mode === "rental" ? targetRental.totalInvested : null,
          rentalTargetPurchasePrice: mode === "rental" ? targetRental.targetPurchasePrice : null,
          rentalNoiAnnual: mode === "rental" ? targetRental.noiAnnual : null,
          rentalCashOnCash: mode === "rental" ? targetRental.cashOnCash : null,
          rentalLegalFee: mode === "rental" ? rentalConfig.legalFee : null,
          rentalAppraisalFee: mode === "rental" && rentalConfig.appraisal ? RENTAL_CONSTANTS.appraisalFee : null,
          rentalSourcingFee: mode === "rental" ? resolveSourcingFee(targetRental.targetPurchasePrice, rentalConfig) : null,
          rentalRenovationCost: mode === "rental" && rentalConfig.renovationBeforeRent ? rentalRenovationCost : null,
          flipNetProfit: mode === "flip" ? targetFlip.netProfit : null,
          flipRoi: mode === "flip" ? targetFlip.roi : null,
          flipAnnualizedRoi: mode === "flip" ? targetFlip.annualizedRoi : null,
          flipCashOnCash: mode === "flip" ? targetFlip.cashOnCash : null,
          flipTotalCost: mode === "flip" ? targetFlip.costs.totalCost : null,
          flipTargetPurchasePrice: mode === "flip" ? targetFlip.targetPurchasePrice : null,
          flipLegalFees: mode === "flip" ? targetFlip.costs.legalFees : null,
          flipAppraisalFee: mode === "flip" ? targetFlip.costs.appraisalFee : null,
          flipContingency: mode === "flip" ? targetFlip.costs.contingency : null,
          flipHoldingCosts: mode === "flip" ? targetFlip.costs.holdingCosts : null,
          flipHoldingMonths: mode === "flip" ? costConfig.holdingMonths : null,
          flipSellingCommission: mode === "flip" ? targetFlip.costs.sellingCommission : null,
          flipMarketingPhoto: mode === "flip" ? targetFlip.costs.marketingPhoto : null,
          flipMortgageCost: mode === "flip" ? targetFlip.costs.mortgageCost : null,
          flipSourcingFee: mode === "flip" ? targetFlip.costs.sourcingFee : null,
          flipStrategy: mode === "flip" ? flipStrategy : null,
          flipProfitTotal: mode === "flip" && targetFlipNoFee ? targetFlipNoFee.netProfit : null,
          flipProfitFiftyFifty: mode === "flip" && targetFlipNoFee ? Math.round(targetFlipNoFee.netProfit / 2) : null,
          flipProfitSourcing: mode === "flip" ? targetFlip.netProfit : null,
          flipIncomeTax: mode === "flip" ? targetFlip.costs.incomeTax : null,
        }),
      });
      setPresetSaved(true);
      setTimeout(() => setPresetSaved(false), 2000);
    } catch {}
    setPresetSaving(false);
  };

  const resetPreset = async () => {
    if (!propertyId) return;
    try { localStorage.removeItem(`report-config-${propertyId}`); } catch {}
    await fetch(`/api/properties/${propertyId}/calc-preset`, { method: "DELETE" });
    setArv(a.arv);
    setRenovationTotal(a.scenarios?.conservative?.renovationCost || 700000);
    setTargetRoi(15);
    setMode("flip");
    setRentalConfig({ ...RENTAL_DEFAULTS, monthlyRent: estimateMonthlyRent(area, a.location?.city ?? null, a.location?.category ?? null) });
    setRentalRenovationMode("preset");
    setRentalRenovationLevel("medium");
    setRentalRenovationPerSqm(Math.round(a.scenarios?.conservative?.renovationCost / area) || 12500);
    setRentalRenovationTotal(a.scenarios?.conservative?.renovationCost || 700000);
    setCostConfig({ sellCommission: false, appraisal: false, sourcingEnabled: true, sourcingFee: 100000, sourcingFeeIsPct: false, holdingMonths: 6, hasMortgage: false, mortgageAmount: 0, mortgageRate: 5 });
    setFlipStrategy("both");
  };

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
    setTargetRoi(Math.max(5, Math.min(100, num)));
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

  const handleRentalPresetChange = (level: "light" | "medium" | "full") => {
    setRentalRenovationMode("preset");
    setRentalRenovationLevel(level);
  };

  const handleRentalRenovationPerSqmChange = (value: string) => {
    setRentalRenovationPerSqm(parseInt(value.replace(/\s/g, "")) || 0);
  };

  const handleRentalRenovationTotalChange = (value: string) => {
    setRentalRenovationTotal(parseInt(value.replace(/\s/g, "").replace(/Kč/g, "")) || 0);
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
          targetPrice: mode === "rental" ? rentalResults.targetPurchasePrice : flipResults.targetPurchasePrice,
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
      if (!res.ok || !data.propertyId) {
        toast.error(data?.error || "Uložení se nezdařilo");
        setDbSaving(false);
        return;
      }
      if (data.propertyId) {
        setDbSaved(true);
        setDbSavedId(data.propertyId);
        if (data.existed) setDbSavedMessage("Již v databázi ✅");
        else setDbSavedMessage("Uloženo ✅");
      }
    } catch {
      toast.error("Uložení se nezdařilo — zkontrolujte připojení");
    }
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
      if (!res.ok || !data.propertyId) {
        toast.error(data?.error || "Uložení se nezdařilo");
        setDbInitiateSaving(false);
        return;
      }
      if (data.propertyId) {
        const initRes = await fetch(`/api/properties/${data.propertyId}/initiate`, { method: "POST" });
        const initData = await initRes.json();
        if (initData.leadId) setSaved(true);
        setDbSaved(true);
        setDbSavedId(data.propertyId);
      }
    } catch {
      toast.error("Uložení se nezdařilo — zkontrolujte připojení");
    }
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
  const sourceInfo = marketSourceInfo(a);
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
                {mode === "rental"
                  ? <Badge variant={rentalVerdictColors[rentalResults.verdict.level]} size="sm">{rentalResults.verdict.label}</Badge>
                  : <Badge variant={verdictBadgeVariant as any} size="sm">{verdictLabels[a.verdictLevel]}</Badge>}
                <Badge variant="score" score={a.investmentScore} size="sm" />
                {l.condition && <span className="rounded-lg bg-card-hover border border-border/50 px-2 py-0.5 text-[10px] text-foreground/80">{conditionLabel(l.condition)}</span>}
                <span className="rounded-lg bg-card-hover border border-border/50 px-2 py-0.5 text-[10px] text-foreground/80">{portalLabel(result.portal)}</span>
                <Link
                  href={`/odhad?url=${encodeURIComponent(result.url)}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors"
                >
                  <Scales size={11} weight="bold" />
                  Odhad ceny
                </Link>
              </div>
            </div>
          </div>

          {/* Image */}
          {l.imageUrls.length > 0 && (
            <div className="overflow-hidden rounded-xl">
              <PropertyImage
                src={l.imageUrls[0]}
                alt={l.title}
                score={a.investmentScore}
                containerClassName="h-48 w-full"
              />
            </div>
          )}

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBox label="Cena" value={formatPrice(l.price)} />
            <InfoBox label="ARV" value={formatPrice(arv)} highlight="text-price" />
            <InfoBox label="Cena za m²" value={formatPrice(a.pricePerSqm > 0 ? a.pricePerSqm : Math.round(l.price / area)) + "/m²"} />
            <InfoBox label="Trh/m²" value={`${formatPrice(a.marketPricePerSqmLow)}–${formatPrice(a.marketPricePerSqmHigh)}`} subtext={sourceInfo?.text} subtextClass={sourceInfo?.className} />
            {mode === "rental"
              ? <InfoBox label="Čistý výnos" value={rentalResults.netYield.toFixed(1) + "%"} highlight={rentalResults.netYield >= rentalConfig.targetYield ? "text-emerald-400" : rentalResults.netYield >= rentalConfig.targetYield - 1 ? "text-amber-400" : "text-red-400"} />
              : <InfoBox label="ROI" value={flipResults.roi.toFixed(1) + "%"} highlight={flipResults.roi >= 15 ? "text-emerald-400" : flipResults.roi >= 10 ? "text-amber-400" : "text-red-400"} />}
            {mode === "rental"
              ? <InfoBox label="Cash-flow / měsíc" value={formatPrice(rentalResults.cashFlowMonthly)} highlight={rentalResults.cashFlowMonthly >= 0 ? "text-price" : "text-red-400"} />
              : <InfoBox label="Čistý zisk" value={formatPrice(flipResults.netProfit)} highlight="text-price" />}
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

          {/* ===== FEATURE 1: FLIP / RENTAL CALCULATOR ===== */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <CurrencyCircleDollar size={16} className="text-accent" />
              <h2 className="font-semibold tracking-tight text-sm flex-1">Kalkulačka</h2>
              <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
                <button
                  onClick={() => setMode("flip")}
                  className={`px-3 py-1.5 transition-colors ${mode === "flip" ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                >Flip</button>
                <button
                  onClick={() => setMode("rental")}
                  className={`px-3 py-1.5 transition-colors ${mode === "rental" ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                >Výnosová</button>
              </div>
            </div>

            {mode === "flip" && (<>
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
                  <button onClick={() => { setRenovationMode("perSqm"); setRenovationPerSqm(12500); }} className={`px-2 py-1 rounded border ${renovationMode === "perSqm" ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 hover:bg-card-hover"}`}>Kč/m²</button>
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
                max={100}
                value={targetRoi}
                onChange={(e) => setTargetRoi(parseInt(e.target.value))}
                className="flex-1 accent-accent h-1.5"
              />
              <span className="text-sm font-mono text-foreground min-w-[3ch] text-right">{targetRoi}%</span>
            </div>

            {/* Způsob spolupráce */}
            <div className="rounded-xl bg-card border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Způsob spolupráce</p>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[
                  { value: "both" as const, label: "Obojí", hint: "investor si vybere" },
                  { value: "fifty-fifty" as const, label: "50/50", hint: "zisk napůl" },
                  { value: "sourcing-fee" as const, label: "Sourcing fee", hint: "kupuje sám" },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      setFlipStrategy(s.value);
                      // Pravidlo kalkulačky: fee za zprostředkování platí vždy kromě 50/50.
                      if (s.value === "fifty-fifty") setCostConfig((prev) => ({ ...prev, sourcingEnabled: false }));
                      else setCostConfig((prev) => ({ ...prev, sourcingEnabled: true }));
                    }}
                    className={`rounded-lg border px-2 py-1.5 text-center transition-colors ${
                      flipStrategy === s.value
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border/50 text-muted hover:bg-card-hover hover:text-foreground"
                    }`}
                  >
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-[10px] opacity-70">{s.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted">
                {flipStrategy === "fifty-fifty"
                  ? "Řemeslnickou část zajišťujeme my, investor financuje celý nákup i rekonstrukci a zisk se dělí napůl."
                  : flipStrategy === "sourcing-fee"
                    ? "Investor obchod kupuje sám a platí nám sourcing fee — ideální kupní cena se počítá s tímto poplatkem."
                    : "Investor si v portálu vybere. Ideální kupní cena se počítá se sourcing fee; u 50/50 se fee vrací do potu a zisk se dělí napůl."}
              </p>
            </div>

            {/* Cost Toggles */}
            <div className="rounded-xl bg-card border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Volitelné náklady</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.sellCommission} onChange={() => toggleConfig("sellCommission")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Provize RK prodejní (5 %)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.appraisal} onChange={() => toggleConfig("appraisal")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Znalecký posudek</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.hasMortgage} onChange={() => toggleConfig("hasMortgage")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Mám hypotéku</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={costConfig.sourcingEnabled} onChange={() => toggleConfig("sourcingEnabled")} className="accent-accent" />
                  <span className="text-foreground/80 whitespace-nowrap">Sourcing fee</span>
                </label>
              </div>
              {costConfig.sourcingEnabled && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                  <span className="text-[10px] text-muted block w-16 shrink-0">Poplatek</span>
                  <input
                    type="number"
                    value={costConfig.sourcingFee || ""}
                    onChange={(e) => setCostConfig((prev) => ({ ...prev, sourcingFee: parseInt(e.target.value) || 0 }))}
                    className="w-24 rounded-lg border border-border/50 bg-card px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-accent/50"
                    placeholder="100000"
                  />
                  <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setCostConfig((prev) => ({ ...prev, sourcingFee: 100000, sourcingFeeIsPct: false }))}
                      className={`px-2 py-1 transition-colors ${!costConfig.sourcingFeeIsPct ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                    >Kč</button>
                    <button
                      type="button"
                      onClick={() => setCostConfig((prev) => ({ ...prev, sourcingFee: 5, sourcingFeeIsPct: true }))}
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
              <p className="text-[10px] text-emerald-400/60 mt-0.5">{formatPrice(area > 0 ? Math.round(flipResults.targetPurchasePrice / area) : 0)} Kč/m²</p>
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
                      ...(costConfig.sellCommission ? [{ label: "Provize RK prodejní (5 %)", value: targetFlipResults.costs.sellingCommission }] : []),
                      ...(!costConfig.sellCommission && targetFlipResults.costs.marketingPhoto > 0 ? [{ label: "Marketing + foto", value: targetFlipResults.costs.marketingPhoto }] : []),
                      { label: `Provozní náklady (${costConfig.holdingMonths} měsíců)`, value: targetFlipResults.costs.holdingCosts },
                      ...(costConfig.hasMortgage && targetFlipResults.costs.mortgageCost > 0 ? [{ label: "Úrok z hypotéky", value: targetFlipResults.costs.mortgageCost }] : []),
                      ...(targetFlipResults.costs.sourcingFee > 0 ? [{ label: "Sourcing fee", value: targetFlipResults.costs.sourcingFee }] : []),
                      { label: `Daň z příjmu (21 %)`, value: targetFlipResults.costs.incomeTax },
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

            {/* Spolupráce — čísla pro investory */}
            {targetFlipNoFee && targetFlipResults && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-1.5 text-xs">
                <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-1">Nabídka investorům</p>
                <div className="flex justify-between">
                  <span className="text-muted">Zisk celého obchodu</span>
                  <span className="font-mono text-foreground">{formatPrice(targetFlipNoFee.netProfit)}</span>
                </div>
                {flipStrategy === "sourcing-fee" ? (
                  <div className="flex justify-between">
                    <span className="text-muted">Váš zisk · 50/50</span>
                    <span className="font-mono text-muted">nenabízeno</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted">Váš zisk · 50/50</span>
                    <span className="font-mono text-emerald-400">{formatPrice(Math.round(targetFlipNoFee.netProfit / 2))}</span>
                  </div>
                )}
                {flipStrategy === "fifty-fifty" ? (
                  <div className="flex justify-between">
                    <span className="text-muted">Váš zisk · sourcing fee</span>
                    <span className="font-mono text-muted">nenabízeno</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted">Váš zisk · sourcing fee</span>
                    <span className="font-mono text-emerald-400">
                      {formatPrice(targetFlipResults.netProfit)}
                      {targetFlipResults.costs.sourcingFee > 0 && (
                        <span className="text-muted text-[10px]"> (po fee {formatPrice(targetFlipResults.costs.sourcingFee)})</span>
                      )}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-muted pt-1.5 border-t border-accent/10">
                  {flipStrategy === "both"
                    ? "Na portálu si investor vybere 50/50 nebo sourcing fee; čísla se přepočtou z vyjednané ceny."
                    : flipStrategy === "fifty-fifty"
                      ? "Na portálu se nabídne jen 50/50 — rekonstrukci zajišťujeme my."
                      : "Na portálu se nabídne jen sourcing fee — investor obchod kupuje sám."}
                </p>
              </div>
            )}

            {/* Čísla při potvrzené vyjednané ceně z pipeline */}
            {negotiatedCoop && targetFlipNoFee && targetFlipResults && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-1.5 text-xs">
                <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-1">
                  Při vyjednané ceně {formatPrice(negotiatedPrice!)}
                </p>
                <div className="flex justify-between">
                  <span className="text-muted">Zisk celého obchodu</span>
                  <span className="font-mono text-foreground">{formatPrice(negotiatedCoop.netProfitTotal ?? 0)}</span>
                </div>
                {flipStrategy !== "sourcing-fee" && (
                  <div className="flex justify-between">
                    <span className="text-muted">Váš zisk · 50/50</span>
                    <span className="font-mono text-emerald-400">{formatPrice(negotiatedCoop.investorProfitFiftyFifty ?? 0)}</span>
                  </div>
                )}
                {flipStrategy !== "fifty-fifty" && (
                  <div className="flex justify-between">
                    <span className="text-muted">Váš zisk · sourcing fee</span>
                    <span className="font-mono text-emerald-400">{formatPrice(negotiatedCoop.investorProfitSourcing ?? 0)}</span>
                  </div>
                )}
                <p className="text-[10px] text-amber-500/70 pt-1.5 border-t border-amber-500/15">
                  Přesně tato čísla uvidí investor v portálu Brickon.
                </p>
              </div>
            )}
            </>)}

            {mode === "rental" && (
              <div className="space-y-4">
                {/* Rent */}
                <div>
                  <label className="text-xs text-muted mb-1 block">Měsíční nájem <span className="text-muted/60">(odhad dle lokality: {formatPrice(estimateMonthlyRent(area, a.location?.city ?? null, a.location?.category ?? null))})</span></label>
                  <input
                    type="text"
                    value={rentalConfig.monthlyRent > 0 ? formatPrice(rentalConfig.monthlyRent) : ""}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\s/g, "").replace(/Kč/g, "")) || 0;
                      updateRental("monthlyRent", num);
                    }}
                    placeholder={formatPrice(estimateMonthlyRent(area, a.location?.city ?? null, a.location?.category ?? null))}
                    className={inputClass}
                  />
                </div>

{/* Assumptions */}
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Růst nájmu (%/rok)" value={rentalConfig.rentGrowthPct} onChange={(v) => updateRental("rentGrowthPct", v)} suffix="%" />
                  <NumberField label="Růst ceny (%/rok)" value={rentalConfig.appreciationPct} onChange={(v) => updateRental("appreciationPct", v)} suffix="%" />
                  <NumberField label="Obsazenost (% / rok)" value={rentalConfig.vacancyPct} onChange={(v) => updateRental("vacancyPct", v)} suffix="%" />
                  <NumberField label="Držení (let)" value={rentalConfig.holdingYears} onChange={(v) => updateRental("holdingYears", v)} suffix="let" />
                  <NumberField label="Správa (% z nájmu)" value={rentalConfig.managementPct} onChange={(v) => updateRental("managementPct", v)} suffix="%" />
                  <NumberField label="Rezerva oprav (% z nájmu)" value={rentalConfig.repairsPct} onChange={(v) => updateRental("repairsPct", v)} suffix="%" />
                  <NumberField label="Pojištění (Kč/rok)" value={rentalConfig.insuranceAnnual} onChange={(v) => updateRental("insuranceAnnual", v)} suffix="Kč" />
                  <NumberField label="Daň z nemovitosti (Kč/rok)" value={rentalConfig.propertyTaxAnnual} onChange={(v) => updateRental("propertyTaxAnnual", v)} suffix="Kč" />
                  <NumberField label="Růst nákladů (%/rok)" value={rentalConfig.expenseGrowthPct} onChange={(v) => updateRental("expenseGrowthPct", v)} suffix="%" />
                </div>

                {/* Target yield */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted shrink-0">Cílový výnos:</label>
                  <input
                    type="range"
                    min={3}
                    max={8}
                    step={0.5}
                    value={rentalConfig.targetYield}
                    onChange={(e) => updateRental("targetYield", parseFloat(e.target.value))}
                    className="flex-1 accent-accent h-1.5"
                  />
                  <span className="text-sm font-mono text-foreground min-w-[3ch] text-right">{rentalConfig.targetYield}%</span>
                </div>

                {/* Renovation (dedicated rental input) */}
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Náklady na rekonstrukci</label>
                  <div className="flex gap-1.5 mb-2">
                    {(["light", "medium", "full"] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => handleRentalPresetChange(level)}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                          rentalRenovationMode === "preset" && rentalRenovationLevel === level
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
                      <button onClick={() => { setRentalRenovationMode("perSqm"); setRentalRenovationPerSqm(12500); }} className={`px-2 py-1 rounded border ${rentalRenovationMode === "perSqm" ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 hover:bg-card-hover"}`}>Kč/m²</button>
                      <button onClick={() => setRentalRenovationMode("total")} className={`px-2 py-1 rounded border ${rentalRenovationMode === "total" ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 hover:bg-card-hover"}`}>Celkem</button>
                    </div>
                    {rentalRenovationMode === "perSqm" ? (
                      <input type="text" value={rentalRenovationPerSqm.toLocaleString()} onChange={(e) => handleRentalRenovationPerSqmChange(e.target.value)} className={inputClass + " flex-1"} />
                    ) : rentalRenovationMode === "total" ? (
                      <input type="text" value={formatPrice(rentalRenovationTotal) || "0"} onChange={(e) => handleRentalRenovationTotalChange(e.target.value)} className={inputClass + " flex-1"} />
                    ) : (
                      <span className="flex-1 text-right text-sm font-mono text-foreground">{formatPrice(rentalRenovationCost)}</span>
                    )}
                  </div>
                </div>

                {/* Rental cost toggles */}
                <div className="rounded-xl bg-card border border-border/50 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Volitelné náklady</p>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rentalConfig.renovationBeforeRent} onChange={() => toggleRental("renovationBeforeRent")} className="accent-accent" />
                      <span className="text-foreground/80 whitespace-nowrap">Rekonstrukce před pronájmem</span>
                    </label>
                    {rentalConfig.renovationBeforeRent && (
                      <div className="flex items-center justify-between text-xs pl-6">
                        <span className="text-muted">Odhad rekonstrukce</span>
                        <span className="font-mono text-foreground">{formatPrice(rentalRenovationCost)}</span>
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rentalConfig.sourcingEnabled} onChange={() => toggleRental("sourcingEnabled")} className="accent-accent" />
                      <span className="text-foreground/80 whitespace-nowrap">Sourcing fee</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rentalConfig.hasMortgage} onChange={() => toggleRental("hasMortgage")} className="accent-accent" />
                      <span className="text-foreground/80 whitespace-nowrap">Mám hypotéku</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rentalConfig.appraisal} onChange={() => toggleRental("appraisal")} className="accent-accent" />
                      <span className="text-foreground/80 whitespace-nowrap">Znalecký posudek</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rentalConfig.rentalIncomeTax} onChange={() => toggleRental("rentalIncomeTax")} className="accent-accent" />
                      <span className="text-foreground/80 whitespace-nowrap">Daň z příjmu z pronájmu (15 % s paušálem 30 %)</span>
                    </label>
                  </div>
                  {rentalConfig.sourcingEnabled && (
                    <div className="flex items-center gap-2 pl-6">
                      <input
                        type="number"
                        value={rentalConfig.sourcingFee || ""}
                        onChange={(e) => updateRental("sourcingFee", parseInt(e.target.value) || 0)}
                        className="w-24 rounded-lg border border-border/50 bg-card px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-accent/50"
                        placeholder="100000"
                      />
                      <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
                        <button
                          onClick={() => { updateRental("sourcingFee", 100000); updateRental("sourcingFeeIsPct", false); }}
                          className={`px-2 py-1 transition-colors ${!rentalConfig.sourcingFeeIsPct ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                        >Kč</button>
                        <button
                          onClick={() => { updateRental("sourcingFee", 5); updateRental("sourcingFeeIsPct", true); }}
                          className={`px-2 py-1 transition-colors ${rentalConfig.sourcingFeeIsPct ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                        >%</button>
                      </div>
                    </div>
                  )}
                  {rentalConfig.hasMortgage && (
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/30">
                      <div>
                        <label className="text-[10px] text-muted block mb-1">Výše úvěru</label>
                        <input
                          type="text"
                          value={rentalConfig.mortgageAmount > 0 ? rentalConfig.mortgageAmount.toLocaleString() : ""}
                          onChange={(e) => updateRental("mortgageAmount", parseInt(e.target.value.replace(/\s/g, "")) || 0)}
                          placeholder="např. 3 000 000"
                          className="w-full rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted block mb-1">Úrok (%)</label>
                        <input
                          type="text"
                          value={rentalConfig.mortgageRate > 0 ? rentalConfig.mortgageRate.toString() : ""}
                          onChange={(e) => updateRental("mortgageRate", parseFloat(e.target.value.replace(",", ".")) || 0)}
                          placeholder="např. 5"
                          className="w-full rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted block mb-1">Doba (let)</label>
                        <input
                          type="text"
                          value={rentalConfig.mortgageTermYears > 0 ? rentalConfig.mortgageTermYears.toString() : ""}
                          onChange={(e) => updateRental("mortgageTermYears", parseInt(e.target.value) || 0)}
                          placeholder="např. 30"
                          className="w-full rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rental metric boxes */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoBox label="Hrubý výnos" value={rentalResults.grossYield.toFixed(1) + "%"} highlight={rentalResults.grossYield >= 8 ? "text-emerald-400" : "text-foreground"} />
                  <InfoBox label="Čistý výnos" value={rentalResults.netYield.toFixed(1) + "%"} highlight={rentalResults.netYield >= rentalConfig.targetYield ? "text-emerald-400" : rentalResults.netYield >= rentalConfig.targetYield - 1 ? "text-amber-400" : "text-red-400"} />
                  <InfoBox label="Výnos po dani" value={rentalResults.netYieldAfterTax.toFixed(1) + "%"} highlight={rentalResults.netYieldAfterTax >= rentalConfig.targetYield - 0.5 ? "text-emerald-400" : rentalResults.netYieldAfterTax >= rentalConfig.targetYield - 1.5 ? "text-amber-400" : "text-red-400"} />
                  <InfoBox label="Cap rate" value={rentalResults.capRate.toFixed(1) + "%"} highlight={rentalResults.capRate >= 6 ? "text-emerald-400" : rentalResults.capRate >= 4 ? "text-amber-400" : "text-red-400"} />
                  <InfoBox label="Výnos na investici" value={rentalResults.yieldOnInvestment.toFixed(1) + "%"} highlight={rentalResults.yieldOnInvestment >= 5 ? "text-emerald-400" : "text-foreground"} />
                  <InfoBox label="Cash-flow / měsíc" value={formatPrice(rentalResults.cashFlowMonthly)} highlight={rentalResults.cashFlowMonthly >= 0 ? "text-price" : "text-red-400"} />
                  <InfoBox label="Cash-on-cash" value={rentalResults.cashOnCash.toFixed(1) + "%"} highlight={rentalResults.cashOnCash >= 6 ? "text-emerald-400" : rentalResults.cashOnCash >= 4 ? "text-amber-400" : "text-red-400"} />
                  <InfoBox label="Návratnost investice" value={rentalResults.paybackYears !== null ? `${rentalResults.paybackYears.toFixed(1)} let` : "—"} highlight={rentalResults.paybackYears !== null && rentalResults.paybackYears <= 15 ? "text-emerald-400" : "text-red-400"} />
                  <InfoBox label="Break-even nájem" value={formatPrice(rentalResults.breakEvenRent) + " /měs"} highlight={rentalResults.breakEvenRent <= rentalConfig.monthlyRent ? "text-emerald-400" : "text-amber-400"} />
                  <InfoBox label="IRR" value={rentalResults.irr !== null ? rentalResults.irr.toFixed(1) + "%" : "—"} highlight={rentalResults.irr !== null ? (rentalResults.irr >= 8 ? "text-emerald-400" : rentalResults.irr >= 6 ? "text-amber-400" : "text-red-400") : "text-muted"} />
                  <InfoBox label="DSCR" value={rentalResults.dscr !== null ? rentalResults.dscr.toFixed(2) + "×" : "—"} highlight={rentalResults.dscr !== null ? (rentalResults.dscr >= 1.25 ? "text-emerald-400" : rentalResults.dscr >= 1 ? "text-amber-400" : "text-red-400") : "text-muted"} />
                  <InfoBox label="Unese splátku" value={formatPrice(rentalResults.maxAffordableDebtMonthly) + " /měs"} highlight={rentalConfig.hasMortgage && rentalResults.mortgageAnnual > 0 ? (rentalResults.maxAffordableDebtMonthly >= rentalResults.mortgageAnnual / 12 ? "text-emerald-400" : "text-red-400") : "text-foreground"} />
                  <InfoBox label="Nájem / plocha" value={area > 0 ? formatPrice(Math.round(rentalConfig.monthlyRent / area)) + "/m²" : "—"} />
                </div>

                {/* Target price highlight */}
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <p className="text-xs text-emerald-400 mb-1">🎯 MAX. KUPNÍ CENA PRO VÝNOS {rentalConfig.targetYield} %</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono">{formatPrice(rentalResults.targetPurchasePrice)}</p>
                  <p className="text-[10px] text-emerald-400/60 mt-0.5">{formatPrice(area > 0 ? Math.round(rentalResults.targetPurchasePrice / area) : 0)} Kč/m²</p>
                  <div className="flex items-center justify-center gap-3 mt-2 text-xs">
                    <span className="text-muted">Aktuální: {formatPrice(l.price)}</span>
                    <span className="text-red-400">↓ {formatPrice(rentalResults.priceReductionNeeded)} ({rentalResults.priceReductionPct}%)</span>
                  </div>
                </div>

                {/* Breakdown at target price */}
                {targetRentalResults && (
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 overflow-hidden">
                    <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400">
                      Výpočet při cílové ceně {formatPrice(rentalResults.targetPurchasePrice)}
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {[
                          { label: "Kupní cena", value: rentalResults.targetPurchasePrice },
                          { label: "Právní služby", value: rentalConfig.legalFee },
                          ...(rentalConfig.appraisal ? [{ label: "Znalecký posudek", value: 5000 }] : []),
                          ...(rentalConfig.sourcingEnabled ? [{ label: "Sourcing fee", value: rentalConfig.sourcingFeeIsPct ? Math.round(rentalResults.targetPurchasePrice * (rentalConfig.sourcingFee / 100)) : rentalConfig.sourcingFee }] : []),
                          ...(rentalConfig.renovationBeforeRent ? [{ label: "Rekonstrukce", value: rentalRenovationCost }] : []),
                        ].map((row) => (
                          <tr key={row.label} className="border-b border-emerald-500/10">
                            <td className="px-3 py-1.5 text-foreground/80">{row.label}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-foreground">{formatPrice(row.value)}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-500/10">
                          <td className="px-3 py-2 font-semibold text-emerald-400">Celková investice</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-400">{formatPrice(targetRentalResults.totalInvested)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="border-t border-emerald-500/20 px-3 py-2 text-xs space-y-1 bg-emerald-500/5">
                      <div className="flex justify-between">
                        <span className="text-emerald-400/70">NOI ročně</span>
                        <span className="font-mono text-emerald-400">{formatPrice(targetRentalResults.noiAnnual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-400/70">Čistý výnos</span>
                        <span className={`font-mono ${targetRentalResults.netYield >= rentalConfig.targetYield ? "text-emerald-400" : "text-amber-400"}`}>{targetRentalResults.netYield.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-400/70">Cash-flow / měsíc</span>
                        <span className={`font-mono ${targetRentalResults.cashFlowMonthly >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatPrice(targetRentalResults.cashFlowMonthly)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-emerald-400/70">Cash-on-cash</span>
                        <span className={`font-mono ${targetRentalResults.cashOnCash >= 6 ? "text-emerald-400" : "text-amber-400"}`}>{targetRentalResults.cashOnCash.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Exit model */}
                <div className="rounded-xl bg-card border border-border/50 p-3 text-xs space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Exit po {rentalConfig.holdingYears} letech</p>
                  <div className="flex justify-between">
                    <span className="text-muted">Hodnota při prodeji</span>
                    <span className="font-mono text-foreground">{formatPrice(rentalResults.exitPrice)}</span>
                  </div>
                  {rentalConfig.hasMortgage && (
                    <div className="flex justify-between">
                      <span className="text-muted">Zůstatek úvěru</span>
                      <span className="font-mono text-foreground">{formatPrice(rentalResults.mortgageBalance)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Čistý výnos z prodeje</span>
                    <span className="font-mono text-foreground">{formatPrice(rentalResults.netExit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Kumulovaný cash-flow</span>
                    <span className="font-mono text-foreground">{formatPrice(rentalResults.cumulativeCashFlow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Daň z prodeje</span>
                    <span className="font-mono text-foreground">{formatPrice(rentalResults.exitTax)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-border/30 font-medium">
                    <span className="text-foreground">Celkový zisk</span>
                    <span className={`font-mono ${rentalResults.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatPrice(rentalResults.totalProfit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">ROI celkem</span>
                    <span className={`font-mono ${rentalResults.totalRoi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{rentalResults.totalRoi.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">ROI p.a. (geo)</span>
                    <span className={`font-mono ${rentalResults.annualizedRoi !== null && rentalResults.annualizedRoi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{rentalResults.annualizedRoi !== null ? rentalResults.annualizedRoi.toFixed(1) + "%" : "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===== SAVE / RESET PRESET ===== */}
          {propertyId && (
            <div className="flex gap-2">
              <button onClick={savePreset} disabled={presetSaving} className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card px-4 py-2 text-xs font-medium text-foreground/80 hover:bg-card-hover hover:border-accent/30 transition-all flex-1 justify-center disabled:opacity-50">
                {presetSaving ? "⏳ Ukládám..." : presetSaved ? "✅ Uloženo" : "💾 Uložit parametry"}
              </button>
              <button onClick={resetPreset} className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card px-4 py-2 text-xs font-medium text-foreground/80 hover:bg-card-hover hover:border-red-500/30 transition-all flex-1 justify-center">
                🔄 Obnovit výchozí
              </button>
            </div>
          )}

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
                      {c.imageUrl && <img src={c.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" loading="lazy" decoding="async" />}
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

function InfoBox({ label, value, highlight, subtext, subtextClass }: { label: string; value: string; highlight?: string; subtext?: string; subtextClass?: string }) {
  return (
    <div className="rounded-xl bg-card-hover border border-border/50 p-3 min-w-0">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-xs font-semibold font-mono leading-snug break-words ${highlight ?? "text-foreground"}`}>{value}</p>
      {subtext && <p className={`text-[10px] mt-0.5 truncate ${subtextClass ?? "text-muted"}`}>{subtext}</p>}
    </div>
  );
}

function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted block mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={value > 0 ? (suffix === "%" ? value.toString() : value.toLocaleString()) : ""}
          onChange={(e) => {
            const num = parseFloat(e.target.value.replace(/\s/g, "").replace(",", ".")) || 0;
            onChange(num);
          }}
          className="w-full rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        <span className="text-muted text-[10px] shrink-0">{suffix}</span>
      </div>
    </div>
  );
}
