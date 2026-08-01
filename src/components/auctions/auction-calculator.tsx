"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, cn } from "@/lib/utils";
import { CheckCircle, WarningCircle, Calculator, FloppyDisk, Scales, ChartLine } from "@phosphor-icons/react";
import {
  calculateAuctionResults,
  type AuctionCalcInput,
} from "@/lib/auctions/auction-flip-costs";
import { resolveRenovationCost } from "@/lib/analysis/flip-costs";
import type { ParsedAuction } from "@/lib/auctions/parse-auction";
import type { AuctionReportData } from "@/components/report/auction-report";

interface AuctionForm {
  title: string;
  address: string;
  oc: number;
  np: number;
  asIsTmv: number;
  td: number;
  discount: number;
  area: number;
  arv: number;
  renovationMode: "preset" | "perSqm" | "total";
  renovationLevel: "light" | "medium" | "full";
  renovationPerSqm: number;
  renovationTotal: number;
  targetRoi: number;
  sellCommission: boolean;
  sourcingEnabled: boolean;
  sourcingFee: number;
  sourcingFeeIsPct: boolean;
  holdingMonths: number;
  // Položkové náklady na akvizici
  tcLegal: number;
  tcEscrow: number;
  tcExecutor: number;
  tcKatastr: number;
  tcRezerva: number;
}

const STORAGE_KEY = "auction-calculator:v2";

const DEFAULT_FORM: AuctionForm = {
  title: "",
  address: "",
  oc: 0,
  np: 0,
  asIsTmv: 0,
  td: 0,
  discount: 30,
  area: 70,
  arv: 0,
  renovationMode: "preset",
  renovationLevel: "medium",
  renovationPerSqm: 10000,
  renovationTotal: 700000,
  targetRoi: 15,
  sellCommission: false,
  sourcingEnabled: false,
  sourcingFee: 100000,
  sourcingFeeIsPct: false,
  holdingMonths: 6,
  tcLegal: 25000,
  tcEscrow: 8000,
  tcExecutor: 5000,
  tcKatastr: 7000,
  tcRezerva: 30000,
};

function loadSavedForm(): AuctionForm {
  if (typeof window === "undefined") return DEFAULT_FORM;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("auction-calculator:v1");
    if (!raw) return DEFAULT_FORM;
    const parsed = JSON.parse(raw) as Partial<AuctionForm>;
    return {
      ...DEFAULT_FORM,
      ...parsed,
      oc: Number(parsed.oc) || 0,
      np: Number(parsed.np) || 0,
      asIsTmv: Number(parsed.asIsTmv) || 0,
      td: Number(parsed.td) || 0,
      discount: Number(parsed.discount) || DEFAULT_FORM.discount,
      area: Number(parsed.area) || DEFAULT_FORM.area,
      arv: Number(parsed.arv) || 0,
      renovationPerSqm: Number(parsed.renovationPerSqm) || DEFAULT_FORM.renovationPerSqm,
      renovationTotal: Number(parsed.renovationTotal) || DEFAULT_FORM.renovationTotal,
      targetRoi: Number(parsed.targetRoi) || DEFAULT_FORM.targetRoi,
      sourcingFee: Number(parsed.sourcingFee) || DEFAULT_FORM.sourcingFee,
      holdingMonths: Number(parsed.holdingMonths) || DEFAULT_FORM.holdingMonths,
      tcLegal: Number(parsed.tcLegal) ?? DEFAULT_FORM.tcLegal,
      tcEscrow: Number(parsed.tcEscrow) ?? DEFAULT_FORM.tcEscrow,
      tcExecutor: Number(parsed.tcExecutor) ?? DEFAULT_FORM.tcExecutor,
      tcKatastr: Number(parsed.tcKatastr) ?? DEFAULT_FORM.tcKatastr,
      tcRezerva: Number(parsed.tcRezerva) ?? DEFAULT_FORM.tcRezerva,
    };
  } catch {
    return DEFAULT_FORM;
  }
}

interface FieldProps {
  label: string;
  helper?: string;
  children: React.ReactNode;
  className?: string;
}

function Field({ label, helper, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-muted block">{label}</label>
      {children}
      {helper && <p className="text-[11px] text-muted/70">{helper}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 text-right";

interface AuctionCalculatorProps {
  data: ParsedAuction | null;
}

export function AuctionCalculator({ data }: AuctionCalculatorProps) {
  const router = useRouter();
  const [form, setForm] = useState<AuctionForm>(loadSavedForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Nová analýza z 1-Click DD vyplní formulář
  useEffect(() => {
    if (!data) return;
    setForm((prev) => ({
      ...prev,
      title: data.title,
      address: data.address ?? prev.address,
      oc: data.appraisalPrice ?? prev.oc,
      np: data.minimumBid ?? prev.np,
      asIsTmv: data.appraisalPrice ?? prev.asIsTmv,
      arv: data.appraisalPrice ?? prev.arv,
      td: data.debtEstimate ?? prev.td,
      area: data.area ?? 0,
    }));
  }, [data]);

  // Autosave do localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  function update<K extends keyof AuctionForm>(key: K, value: AuctionForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleConfig(key: "sellCommission" | "sourcingEnabled") {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const tc = form.tcLegal + form.tcEscrow + form.tcExecutor + form.tcKatastr + form.tcRezerva;

  const renovationCost = useMemo(
    () =>
      resolveRenovationCost(
        form.renovationMode,
        form.renovationLevel,
        form.renovationPerSqm,
        form.renovationTotal,
        form.area
      ),
    [form.renovationMode, form.renovationLevel, form.renovationPerSqm, form.renovationTotal, form.area]
  );

  const calcInput: AuctionCalcInput = useMemo(
    () => ({
      asIsTmv: form.asIsTmv,
      td: form.td,
      tc,
      np: form.np || null,
      arv: form.arv,
      renovationCost,
      area: form.area,
      discount: form.discount,
      config: {
        sellCommission: form.sellCommission,
        sourcingEnabled: form.sourcingEnabled,
        sourcingFee: form.sourcingFee,
        sourcingFeeIsPct: form.sourcingFeeIsPct,
        holdingMonths: form.holdingMonths,
      },
    }),
    [form, tc, renovationCost]
  );

  const results = useMemo(() => calculateAuctionResults(calcInput, form.targetRoi), [calcInput, form.targetRoi]);

  const filled = form.title.trim() !== "" || form.oc > 0 || form.np > 0 || form.asIsTmv > 0;

  const handleSaveToDb = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/properties/create-from-auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsed: data ?? { sourceUrl: "", title: form.title, address: form.address },
          calc: {
            asIsTmv: form.asIsTmv,
            td: form.td,
            tc,
            np: form.np || null,
            arv: form.arv,
            renovationCost,
            area: form.area,
            discount: form.discount,
            targetRoi: form.targetRoi,
            holdingMonths: form.holdingMonths,
            sellCommission: form.sellCommission,
            sourcingEnabled: form.sourcingEnabled,
            sourcingFee: form.sourcingFee,
            sourcingFeeIsPct: form.sourcingFeeIsPct,
          },
          aiSummary: null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.propertyId) {
        setSaveError(json?.error ?? "Uložení se nezdařilo. Zkuste to prosím později.");
        return;
      }
      setSaved(true);
      router.push(`/properties/${json.propertyId}`);
    } catch {
      setSaveError("Chyba sítě — zkontrolujte připojení.");
    } finally {
      setSaving(false);
    }
  };

  const strategyLabel = form.sourcingEnabled ? "Sourcing fee" : "50/50";

  function openReport(type: "investor" | "owner") {
    const reportData: AuctionReportData = {
      title: form.title,
      address: form.address,
      caseNumber: data?.caseNumber ?? null,
      auctionDate: data?.auctionDate ?? null,
      oc: form.oc,
      np: form.np,
      asIsTmv: form.asIsTmv,
      td: form.td,
      tc,
      discount: form.discount,
      renovationCost,
      arv: form.arv,
      holdingMonths: form.holdingMonths,
      sellCommission: form.sellCommission,
      sourcingEnabled: form.sourcingEnabled,
      sourcingFee: form.sourcingFee,
      sourcingFeeIsPct: form.sourcingFeeIsPct,
      targetRoi: form.targetRoi,
      strategy: results.strategy,
      tbp: results.tbp,
      nco: results.nco,
      feasible: results.feasible,
      auctionPayout: results.auctionPayout,
      negotiationAdvantage: results.negotiationAdvantage,
      ceilingPrice: results.ceilingPrice,
      breakEvenPrice: results.breakEvenPrice,
      netProfit: results.netProfit,
      roi: results.roi,
      annualizedRoi: results.annualizedRoi,
      cashOnCash: results.cashOnCash,
      investorProfit: results.investorProfit,
      dealmakerProfit: results.dealmakerProfit,
      costs: {
        contingency: results.costs.contingency,
        sellingCommission: results.costs.sellingCommission,
        marketingPhoto: results.costs.marketingPhoto,
        holdingCosts: results.costs.holdingCosts,
        sourcingFee: results.costs.sourcingFee,
        incomeTax: results.costs.incomeTax,
        totalCost: results.costs.totalCost,
      },
    };
    try {
      sessionStorage.setItem("auction-report:v1", JSON.stringify({ data: reportData, type }));
    } catch {}
    router.push("/report/auction");
  }

  return (
    <div className="space-y-6">
      {/* ===== Formulář ===== */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={18} weight="duotone" className="text-accent" />
              <h2 className="font-semibold tracking-tight text-sm">
                Kalkulačka výkupu před dražbou
              </h2>
            </div>
            <button
              onClick={() => setForm(DEFAULT_FORM)}
              className="text-xs text-muted hover:text-danger transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Základní údaje */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Název" className="sm:col-span-2 lg:col-span-2">
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Název dražby / nemovitosti"
              />
            </Field>
            <Field label="Adresa">
              <Input
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Ulice, město"
              />
            </Field>
            <Field label="OC – odhadní cena" helper="Ze znaleckého posudku">
              <Input
                type="number"
                min={0}
                value={form.oc || ""}
                onChange={(e) => update("oc", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="NP – nejnižší podání">
              <Input
                type="number"
                min={0}
                value={form.np || ""}
                onChange={(e) => update("np", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field
              label="AsIs TMV (tržní hodnota jak stojí)"
              helper="100 % trhu – výchozí = OC"
            >
              <Input
                type="number"
                min={0}
                value={form.asIsTmv || ""}
                onChange={(e) => update("asIsTmv", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="Cílová sleva (%)" helper="Investor kupuje za (100 − sleva) % trhu">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.discount || ""}
                onChange={(e) => update("discount", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="TD – celkové dluhy" helper="Z KN, vyhlášky a vyčíslení exekutora">
              <Input
                type="number"
                min={0}
                value={form.td || ""}
                onChange={(e) => update("td", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="Plocha (m²)">
              <Input
                type="number"
                min={0}
                value={form.area || ""}
                onChange={(e) => update("area", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
          </div>

          {/* Náklady na akvizici (TC) – položkově */}
          <div className="rounded-xl bg-card border border-border/50 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Náklady na akvizici (TC) – právní servis, úschova, exekutor, poplatky
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(
                [
                  ["tcLegal", "Právní servis"],
                  ["tcEscrow", "Advokátní úschova"],
                  ["tcExecutor", "Poplatky exekutora"],
                  ["tcKatastr", "Katastr, kolky, výpisy"],
                  ["tcRezerva", "Rezerva"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] text-muted block mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key] > 0 ? form[key].toLocaleString("cs-CZ") : ""}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\s/g, "")) || 0;
                      update(key, num);
                    }}
                    className={inputClass + " text-xs py-1.5"}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <span className="text-xs text-muted">TC celkem</span>
              <span className="text-sm font-mono font-semibold text-foreground">{formatPrice(tc)}</span>
            </div>
          </div>

          {/* Rekonstrukce + ARV */}
          <div className="rounded-xl bg-card border border-border/50 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Rekonstrukce a ARV
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ARV (hodnota po rekonstrukci)" helper="Výchozí = AsIs TMV">
                <Input
                  type="number"
                  min={0}
                  value={form.arv || ""}
                  onChange={(e) => update("arv", Number(e.target.value))}
                  className="font-mono"
                />
              </Field>
              <div className="space-y-1">
                <label className="text-xs text-muted block">Náklady na rekonstrukci</label>
                <div className="flex gap-1.5">
                  {(["light", "medium", "full"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        update("renovationMode", "preset");
                        update("renovationLevel", level);
                      }}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                        form.renovationMode === "preset" && form.renovationLevel === level
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
                    <button
                      onClick={() => update("renovationMode", "perSqm")}
                      className={`px-2 py-1 rounded border ${form.renovationMode === "perSqm" ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 hover:bg-card-hover"}`}
                    >
                      Kč/m²
                    </button>
                    <button
                      onClick={() => update("renovationMode", "total")}
                      className={`px-2 py-1 rounded border ${form.renovationMode === "total" ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 hover:bg-card-hover"}`}
                    >
                      Celkem
                    </button>
                  </div>
                  {form.renovationMode === "perSqm" ? (
                    <input
                      type="text"
                      value={form.renovationPerSqm.toLocaleString("cs-CZ")}
                      onChange={(e) => {
                        const num = parseInt(e.target.value.replace(/\s/g, "")) || 0;
                        update("renovationPerSqm", num);
                      }}
                      className={inputClass + " flex-1"}
                    />
                  ) : form.renovationMode === "total" ? (
                    <input
                      type="text"
                      value={form.renovationTotal > 0 ? form.renovationTotal.toLocaleString("cs-CZ") : ""}
                      onChange={(e) => {
                        const num = parseInt(e.target.value.replace(/\s/g, "")) || 0;
                        update("renovationTotal", num);
                      }}
                      className={inputClass + " flex-1"}
                    />
                  ) : (
                    <span className="flex-1 text-right text-sm font-mono text-foreground">
                      {formatPrice(renovationCost)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cílové ROI + volitelné náklady */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted shrink-0">Cílové ROI:</label>
            <input
              type="range"
              min={5}
              max={100}
              value={form.targetRoi}
              onChange={(e) => update("targetRoi", parseInt(e.target.value))}
              className="flex-1 accent-accent h-1.5"
            />
            <span className="text-sm font-mono text-foreground min-w-[3ch] text-right">{form.targetRoi}%</span>
          </div>

          <div className="rounded-xl bg-card border border-border/50 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Volitelné náklady</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.sellCommission} onChange={() => toggleConfig("sellCommission")} className="accent-accent" />
                <span className="text-foreground/80 whitespace-nowrap">Provize RK prodejní (5 %)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.sourcingEnabled} onChange={() => toggleConfig("sourcingEnabled")} className="accent-accent" />
                <span className="text-foreground/80 whitespace-nowrap">Sourcing fee</span>
              </label>
            </div>
            {form.sourcingEnabled && (
              <div className="flex items-center gap-2 pl-6 pt-1">
                <input
                  type="number"
                  value={form.sourcingFee || ""}
                  onChange={(e) => update("sourcingFee", parseInt(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-border/50 bg-card px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-accent/50"
                  placeholder="100000"
                />
                <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
                  <button
                    onClick={() => update("sourcingFeeIsPct", false)}
                    className={`px-2 py-1 transition-colors ${!form.sourcingFeeIsPct ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                  >
                    Kč
                  </button>
                  <button
                    onClick={() => update("sourcingFeeIsPct", true)}
                    className={`px-2 py-1 transition-colors ${form.sourcingFeeIsPct ? "bg-accent text-white" : "bg-card text-muted hover:text-foreground"}`}
                  >
                    %
                  </button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted/70 pt-1 border-t border-border/30">
              Zaškrtnuto = sourcing fee (odměna dealmakera platí investor) · nezaškrtnuto = model 50/50
            </p>
          </div>
        </CardContent>
      </Card>

      {filled && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* ===== 1. Výkup před dražbou (tahák pro dealmakera) ===== */}
          <Card className="no-print">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Scales size={16} weight="duotone" className="text-accent" />
                <h2 className="font-semibold tracking-tight text-sm">
                  Výkup před dražbou – tahák pro vyjednávání
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <p className="text-xs text-emerald-400 mb-1">🎯 IDEÁLNÍ VÝKUPNÍ CENA ({(100 - form.discount)} % trhu)</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono">
                    {formatPrice(results.tbp)}
                  </p>
                  <p className="text-[10px] text-emerald-400/60 mt-0.5">
                    {form.area > 0 ? `${formatPrice(Math.round(results.tbp / form.area))} Kč/m²` : ""}
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-2 text-xs">
                    <span className="text-muted">AsIs TMV: {formatPrice(form.asIsTmv)}</span>
                    <span className="text-red-400">↓ {form.discount} %</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card-hover p-4">
                  <p className="text-xs text-muted mb-1">NCO – zůstane dlužníkovi na ruku</p>
                  <p className="text-xl font-mono font-semibold text-emerald-400">
                    {formatPrice(results.nco)}
                  </p>
                  <p className="text-[11px] text-muted/70 mt-1">TBP − TD − TC</p>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-xl border p-4 flex items-start gap-3",
                  results.feasible
                    ? "border-success/30 bg-success/10"
                    : "border-danger/30 bg-danger/10"
                )}
              >
                {results.feasible ? (
                  <CheckCircle size={20} weight="duotone" className="text-success shrink-0 mt-0.5" />
                ) : (
                  <WarningCircle size={20} weight="duotone" className="text-danger shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={cn("text-sm font-medium", results.feasible ? "text-success" : "text-danger")}>
                    {results.feasible
                      ? "Výkup je realizovatelný."
                      : "Riziko: Dluhy přesahují nabídkovou cenu."}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {results.feasible
                      ? `Majiteli zbyde na ruku ${formatPrice(results.nco)}.`
                      : "Nutno vyjednat slevu s věřiteli (haircut)."}
                  </p>
                </div>
              </div>

              {/* Vyjednávací argument vs. dražba */}
              <div className="rounded-xl bg-card border border-border/50 p-4">
                <p className="text-xs text-muted mb-2 font-medium">💬 Argument pro dlužníka</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">V dražbě by dlužník dostal (NP − dluhy)</span>
                    <span className="font-mono text-foreground">{formatPrice(Math.max(0, results.auctionPayout))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Náš výkup (TBP − dluhy − náklady)</span>
                    <span className="font-mono text-foreground">{formatPrice(results.nco)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t border-border/30 pt-1.5">
                    <span className="text-muted">Výhoda dlužníka</span>
                    <span className={cn("font-mono", results.negotiationAdvantage > 0 ? "text-success" : "text-danger")}>
                      {results.negotiationAdvantage > 0 ? "+" : ""}{formatPrice(results.negotiationAdvantage)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vyjednávací rozsah */}
              <div className="rounded-xl bg-card border border-border/50 p-4">
                <p className="text-xs text-muted mb-2 font-medium">Vyjednávací rozsah</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-card-hover border border-border/50 p-2 text-center">
                    <p className="text-muted">Ideál ({(100 - form.discount)} % trhu)</p>
                    <p className="font-mono font-semibold text-accent mt-0.5">{formatPrice(results.tbp)}</p>
                  </div>
                  <div className="rounded-lg bg-card-hover border border-border/50 p-2 text-center">
                    <p className="text-muted">Strop (cílové ROI {form.targetRoi} %)</p>
                    <p className="font-mono font-semibold text-foreground mt-0.5">{formatPrice(results.ceilingPrice)}</p>
                  </div>
                  <div className="rounded-lg bg-card-hover border border-border/50 p-2 text-center">
                    <p className="text-muted">Break-even</p>
                    <p className="font-mono font-semibold text-danger mt-0.5">{formatPrice(results.breakEvenPrice)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted mt-2">
                  Nepřekračuj strop – investor by nenaplnil cílové ROI. Break-even je absolutní hranice ztráty.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ===== 2. Investiční výpočet (pro investora) ===== */}
          <Card className="no-print">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Calculator size={16} weight="duotone" className="text-accent" />
                <h2 className="font-semibold tracking-tight text-sm">
                  Investiční výpočet ({strategyLabel})
                </h2>
              </div>

              {/* Zisk + ROI */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/50 bg-card-hover p-4 text-center">
                  <p className="text-xs text-muted mb-1">Čistý zisk investora</p>
                  <p className={cn("text-2xl font-mono font-bold", results.investorProfit >= 0 ? "text-success" : "text-danger")}>
                    {formatPrice(results.investorProfit)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card-hover p-4 text-center">
                  <p className="text-xs text-muted mb-1">ROI</p>
                  <p className={cn("text-2xl font-mono font-bold", results.roi >= form.targetRoi ? "text-success" : "text-warning")}>
                    {results.roi.toFixed(1)} %
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card-hover p-4 text-center">
                  <p className="text-xs text-muted mb-1">Roční ROI</p>
                  <p className="text-2xl font-mono font-bold text-foreground">{results.annualizedRoi.toFixed(1)} %</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card-hover p-4 text-center">
                  <p className="text-xs text-muted mb-1">Cash-on-cash</p>
                  <p className="text-2xl font-mono font-bold text-foreground">{results.cashOnCash.toFixed(1)} %</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-card border border-border/50 p-3">
                  <p className="text-xs text-muted mb-1.5">Zisk pro dealmakera</p>
                  <p className="text-lg font-mono font-semibold text-accent">{formatPrice(results.dealmakerProfit)}</p>
                  <p className="text-[11px] text-muted/70 mt-0.5">
                    {form.sourcingEnabled
                      ? "Sourcing fee (platí investor)"
                      : "50 % ze zisku flipu"}
                  </p>
                </div>
                <div className="rounded-xl bg-card border border-border/50 p-3">
                  <p className="text-xs text-muted mb-1.5">Náklady celkem (včetně daně)</p>
                  <p className="text-lg font-mono font-semibold text-foreground">{formatPrice(results.costs.totalCost)}</p>
                  <p className="text-[11px] text-muted/70 mt-0.5">ARV − náklady = zisk</p>
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 overflow-hidden">
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400">
                  Nákladová struktura při výkupní ceně {formatPrice(results.tbp)}
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { label: "Výkupní cena (TBP)", value: results.tbp },
                      { label: "Dluhy (TD)", value: form.td },
                      { label: "Náklady na akvizici (TC)", value: tc },
                      { label: "Rekonstrukce", value: renovationCost },
                      { label: "Rezerva 10 %", value: results.costs.contingency },
                      ...(form.sellCommission
                        ? [{ label: "Provize RK prodejní (5 %)", value: results.costs.sellingCommission }]
                        : [{ label: "Marketing + foto", value: results.costs.marketingPhoto }]),
                      { label: `Provozní náklady (${form.holdingMonths} měs.)`, value: results.costs.holdingCosts },
                      ...(form.sourcingEnabled && results.costs.sourcingFee > 0
                        ? [{ label: "Sourcing fee", value: results.costs.sourcingFee }]
                        : []),
                      { label: "Daň z příjmu (21 %)", value: results.costs.incomeTax },
                    ].map((row) => (
                      <tr key={row.label} className="border-b border-emerald-500/10">
                        <td className="px-3 py-1.5 text-foreground/80">{row.label}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground">{formatPrice(row.value)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-500/10">
                      <td className="px-3 py-2 font-semibold text-emerald-400">Náklady celkem</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-400">{formatPrice(results.costs.totalCost)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="border-t border-emerald-500/20 px-3 py-2 text-xs space-y-1 bg-emerald-500/5">
                  <div className="flex justify-between">
                    <span className="text-emerald-400/70">ARV</span>
                    <span className="font-mono text-emerald-400">{formatPrice(form.arv)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400/70">Zisk</span>
                    <span className={`font-mono ${results.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatPrice(results.netProfit)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-emerald-400/70">ROI</span>
                    <span className={`font-mono ${results.roi >= form.targetRoi ? "text-emerald-400" : results.roi >= 10 ? "text-amber-400" : "text-red-400"}`}>{results.roi.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== Uložit + PDF report ===== */}
          <Card className="no-print">
            <CardContent className="p-5 space-y-3">
              {saveError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-xs text-red-400">{saveError}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSaveToDb} disabled={saving || !data} className="flex-1 min-w-[220px]">
                  <FloppyDisk weight="duotone" />
                  {saving ? "Ukládám..." : data ? "Uložit do databáze" : "Nejprve analyzujte dražbu"}
                </Button>
                <Button
                  onClick={() => openReport("investor")}
                  variant="secondary"
                  className="flex-1 min-w-[200px]"
                >
                  <ChartLine weight="duotone" />
                  Report pro investora
                </Button>
                <Button
                  onClick={() => openReport("owner")}
                  variant="secondary"
                  className="flex-1 min-w-[200px]"
                >
                  <Scales weight="duotone" />
                  Report pro majitele
                </Button>
              </div>
              {saved && (
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
                  <p className="text-sm text-emerald-400 font-medium">✅ Uloženo do nemovitostí</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
