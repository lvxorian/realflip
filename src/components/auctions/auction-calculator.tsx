"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, cn } from "@/lib/utils";
import { CheckCircle, WarningCircle, Printer, Calculator } from "@phosphor-icons/react";
import type { ParsedAuction } from "@/lib/auctions/parse-auction";

interface AuctionForm {
  title: string;
  address: string;
  oc: number;
  np: number;
  asIsTmv: number;
  td: number;
  discount: number;
  tc: number;
  sourcingFee: number;
  rc: number;
  arv: number;
}

const STORAGE_KEY = "auction-calculator:v1";

const DEFAULT_FORM: AuctionForm = {
  title: "",
  address: "",
  oc: 0,
  np: 0,
  asIsTmv: 0,
  td: 0,
  discount: 30,
  tc: 75_000,
  sourcingFee: 100_000,
  rc: 0,
  arv: 0,
};

function loadSavedForm(): AuctionForm {
  if (typeof window === "undefined") return DEFAULT_FORM;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
      tc: Number(parsed.tc) || DEFAULT_FORM.tc,
      sourcingFee: Number(parsed.sourcingFee) || DEFAULT_FORM.sourcingFee,
      rc: Number(parsed.rc) || 0,
      arv: Number(parsed.arv) || 0,
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

interface AuctionCalculatorProps {
  data: ParsedAuction | null;
}

export function AuctionCalculator({ data }: AuctionCalculatorProps) {
  const [form, setForm] = useState<AuctionForm>(loadSavedForm);

  // Nová analýza z 1-Click DD vyplní formulář
  useEffect(() => {
    if (!data) return;
    setForm((prev) => ({
      ...prev,
      title: data.title,
      address: data.address ?? "",
      oc: data.appraisalPrice ?? prev.oc,
      np: data.minimumBid ?? prev.np,
      asIsTmv: data.appraisalPrice ?? prev.asIsTmv,
      arv: data.appraisalPrice ?? prev.arv,
    }));
  }, [data]);

  // Autosave do localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  function update<K extends keyof AuctionForm>(key: K, value: AuctionForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const results = useMemo(() => {
    const tbp = (form.asIsTmv * (100 - form.discount)) / 100;
    const nco = tbp - form.td - form.tc;
    const profit =
      form.rc > 0
        ? form.arv - (tbp + form.tc + form.rc + form.sourcingFee)
        : form.asIsTmv - (tbp + form.tc + form.sourcingFee);
    return { tbp, nco, profit, feasible: nco > 0 };
  }, [form]);

  const filled = form.title.trim() !== "" || form.oc > 0 || form.np > 0;

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #auction-print-area, #auction-print-area * { visibility: visible; }
          #auction-print-area { position: absolute; left: 0; right: 0; top: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ===== Formulář ===== */}
      <Card className="no-print">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={18} weight="duotone" className="text-accent" />
              <h2 className="font-semibold tracking-tight text-sm">
                Kalkulačka přímého výkupu
              </h2>
            </div>
            <button
              onClick={() => setForm(DEFAULT_FORM)}
              className="text-xs text-muted hover:text-danger transition-colors"
            >
              Reset
            </button>
          </div>

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
              label="AsIs TMV"
              helper="Tržní hodnota jak stojí (výchozí = OC)"
            >
              <Input
                type="number"
                min={0}
                value={form.asIsTmv || ""}
                onChange={(e) => update("asIsTmv", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="TD – celkové dluhy" helper="Zjištěné z KN a posudku">
              <Input
                type="number"
                min={0}
                value={form.td || ""}
                onChange={(e) => update("td", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="Cílová sleva (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.discount || ""}
                onChange={(e) => update("discount", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="TC – právní a servisní náklady">
              <Input
                type="number"
                min={0}
                value={form.tc || ""}
                onChange={(e) => update("tc", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="Sourcing Fee">
              <Input
                type="number"
                min={0}
                value={form.sourcingFee || ""}
                onChange={(e) => update("sourcingFee", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="RC – rekonstrukce" helper="0 = přímý výkup bez rekonstrukce">
              <Input
                type="number"
                min={0}
                value={form.rc || ""}
                onChange={(e) => update("rc", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="ARV" helper="Hodnota po rekonstrukci (výchozí = AsIs TMV)">
              <Input
                type="number"
                min={0}
                value={form.arv || ""}
                onChange={(e) => update("arv", Number(e.target.value))}
                className="font-mono"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {filled && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* ===== Výsledky ===== */}
          <Card className="no-print">
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-card-hover p-4">
                  <p className="text-xs text-muted mb-1">
                    TBP – nabídková cena po slevě
                  </p>
                  <p className="text-xl font-mono font-semibold">
                    {formatPrice(Math.round(results.tbp))}
                  </p>
                  <p className="text-[11px] text-muted/70 mt-1">
                    AsIs TMV × (100 − {form.discount} %) / 100
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card-hover p-4">
                  <p className="text-xs text-muted mb-1">NCO – zůstane majiteli na ruku</p>
                  <p
                    className={cn(
                      "text-xl font-mono font-semibold",
                      results.feasible ? "text-success" : "text-danger"
                    )}
                  >
                    {formatPrice(Math.round(results.nco))}
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
                      ? `Majiteli zbyde na ruku ${formatPrice(Math.round(results.nco))}.`
                      : "Nutno vyjednat slevu s věřiteli (haircut)."}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card-hover p-4 text-center">
                <p className="text-xs text-muted mb-1">
                  {form.rc > 0 ? "Zisk (s rekonstrukcí)" : "Zisk (přímý výkup)"}
                </p>
                <p
                  className={cn(
                    "text-3xl font-mono font-bold tracking-tight",
                    results.profit >= 0 ? "text-success" : "text-danger"
                  )}
                >
                  {formatPrice(Math.round(results.profit))}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ===== PDF report ===== */}
          <Card className="no-print">
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold tracking-tight text-sm">PDF Report</h2>
                <p className="text-xs text-muted mt-0.5">
                  Kompletní investiční analýza dražby k vytisknutí či uložení
                </p>
              </div>
              <Button onClick={() => window.print()}>
                <Printer weight="duotone" />
                Investiční analýza ke stažení
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ===== Print area (viditelná jen při tisku) ===== */}
      <div id="auction-print-area" className="hidden print:block text-black">
        <div className="mb-6 pb-4 border-b border-black/20">
          <h1 className="text-lg font-bold">Investiční analýza – Dražba</h1>
          <p className="text-sm">{form.title}</p>
          {form.address && <p className="text-sm">{form.address}</p>}
          <p className="text-xs mt-1">
            Vygenerováno {new Date().toLocaleDateString("cs-CZ")}
          </p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4">OC – odhadní cena</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.oc)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">NP – nejnižší podání</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.np)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">AsIs TMV</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.asIsTmv)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">TD – celkové dluhy</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.td)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Cílová sleva</td>
              <td className="py-1 font-mono text-right">{form.discount} %</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">TC – právní a servisní náklady</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.tc)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Sourcing Fee</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.sourcingFee)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">RC – rekonstrukce</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.rc)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">ARV</td>
              <td className="py-1 font-mono text-right">{formatPrice(form.arv)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 pt-4 border-t border-black/20 space-y-1">
          <div className="flex justify-between text-sm font-semibold">
            <span>TBP – nabídková cena po slevě</span>
            <span className="font-mono">{formatPrice(Math.round(results.tbp))}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>NCO – zůstane majiteli na ruku</span>
            <span className="font-mono">{formatPrice(Math.round(results.nco))}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>{form.rc > 0 ? "Zisk (s rekonstrukcí)" : "Zisk (přímý výkup)"}</span>
            <span className="font-mono">{formatPrice(Math.round(results.profit))}</span>
          </div>
        </div>
        <div
          className={cn(
            "mt-6 border-2 p-4 text-sm font-semibold",
            results.feasible ? "border-black" : "border-black"
          )}
        >
          {results.feasible
            ? "Verdikt: Výkup je realizovatelný. Majiteli zbyde na ruku " +
              formatPrice(Math.round(results.nco)) +
              "."
            : "Verdikt: Riziko – dluhy přesahují nabídkovou cenu. Nutno vyjednat slevu s věřiteli (haircut)."}
        </div>
      </div>
    </div>
  );
}
