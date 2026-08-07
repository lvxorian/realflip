"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MagnifyingGlass, PencilLine } from "@phosphor-icons/react";
import { MARKET_DATA } from "@/lib/analysis/market-data";
import { cityKeyToName } from "@/lib/geocode";
import type { ValuationInput } from "@/lib/valuation/types";

const CONDITION_OPTIONS = [
  { key: "new", label: "Novostavba" },
  { key: "renovated", label: "Po rekonstrukci" },
  { key: "good", label: "Průměrný" },
  { key: "original", label: "Před rekonstrukcí" },
  { key: "dilapidated", label: "Neobyvatelný" },
  { key: "project", label: "Projekt" },
];

const BUILDING_OPTIONS = [
  { key: "brick", label: "Cihlový" },
  { key: "panel", label: "Panelový" },
  { key: "new", label: "Novostavba" },
  { key: "mixed", label: "Smíšený" },
];

const TYPE_OPTIONS = [
  { key: "flat", label: "Byt" },
  { key: "house", label: "Dům" },
  { key: "land", label: "Pozemek" },
];

const inputCls =
  "w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow";
const labelCls = "block text-xs font-medium text-muted mb-1.5";

interface Props {
  fields: ValuationInput;
  setFields: (f: ValuationInput) => void;
  url: string;
  setUrl: (u: string) => void;
  parsing: boolean;
  estimating: boolean;
  error: string | null;
  parsed: boolean;
  onParseUrl: () => void;
  onEstimate: () => void;
}

export default function ValuationInput({
  fields,
  setFields,
  url,
  setUrl,
  parsing,
  estimating,
  error,
  parsed,
  onParseUrl,
  onEstimate,
}: Props) {
  const cityOptions = useMemo(
    () =>
      Object.keys(MARKET_DATA)
        .map((key) => ({ key, name: cityKeyToName(key) ?? key }))
        .sort((a, b) => a.name.localeCompare(b.name, "cs")),
    []
  );
  const cityLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cityOptions) {
      map[c.name.toLowerCase()] = c.key;
      map[c.key.toLowerCase()] = c.key;
    }
    return map;
  }, [cityOptions]);

  const set = <K extends keyof ValuationInput>(k: K, v: ValuationInput[K]) => setFields({ ...fields, [k]: v });

  const canEstimate = Boolean(fields.cityKey && fields.area && fields.area > 0);
  const missingCity = !fields.cityKey;
  const missingArea = !fields.area || fields.area <= 0;

  return (
    <div className="space-y-4">
      {/* URL */}
      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium mb-1.5">Odkaz na inzerát</p>
          <p className="text-xs text-muted mb-3">
            Podporované portály: sreality.cz, bezrealitky.cz, reality.cz, realitymat.cz, idnes.reality.cz, bazos.cz, mmreality.cz, hyperinzerce.cz, annonce.cz
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.sreality.cz/detail/prodej/byt/…"
              className={inputCls}
            />
            <Button onClick={onParseUrl} disabled={!url.trim() || parsing} className="shrink-0 sm:w-auto">
              {parsing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Načítám…
                </>
              ) : (
                <>
                  <MagnifyingGlass size={16} weight="bold" />
                  Načíst z inzerátu
                </>
              )}
            </Button>
          </div>
          {parsed && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400 mt-3">
              <PencilLine size={13} weight="bold" />
              Data z inzerátu načtena — zkontrolujte a doplňte chybějící údaje.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Formulář */}
      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium mb-4">Údaje o nemovitosti</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelCls}>
                Lokalita <span className="text-danger">*</span>
              </label>
              <input
                list="odhad-cities"
                value={cityKeyToName(fields.cityKey) ?? ""}
                onChange={(e) => {
                  const key = cityLookup[e.target.value.trim().toLowerCase()];
                  set("cityKey", key ?? "");
                }}
                placeholder="Zadejte město"
                className={`${inputCls} ${missingCity ? "border-amber-500/50" : ""}`}
              />
              <datalist id="odhad-cities">
                {cityOptions.map((c) => (
                  <option key={c.key} value={c.name} />
                ))}
              </datalist>
              {missingCity && <p className="text-[10px] text-amber-400 mt-1">Vyberte lokalitu z nabídky</p>}
            </div>

            <div>
              <label className={labelCls}>Typ nemovitosti</label>
              <select value={fields.type ?? "flat"} onChange={(e) => set("type", e.target.value as ValuationInput["type"])} className={inputCls}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Dispozice</label>
              <input value={fields.disposition ?? ""} onChange={(e) => set("disposition", e.target.value || null)} placeholder="např. 2+kk" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>
                Plocha (m²) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={fields.area ?? ""}
                onChange={(e) => set("area", e.target.value ? Number(e.target.value) : null)}
                placeholder="např. 65"
                className={`${inputCls} ${missingArea ? "border-amber-500/50" : ""}`}
              />
              {missingArea && <p className="text-[10px] text-amber-400 mt-1">Plocha je nutná</p>}
            </div>

            <div>
              <label className={labelCls}>Stav</label>
              <select value={fields.condition ?? ""} onChange={(e) => set("condition", e.target.value || null)} className={inputCls}>
                <option value="">Neznámý</option>
                {CONDITION_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Konstrukce</label>
              <select value={fields.buildingType ?? ""} onChange={(e) => set("buildingType", e.target.value || null)} className={inputCls}>
                <option value="">Neznámá</option>
                {BUILDING_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Patro</label>
              <input type="number" value={fields.floor ?? ""} onChange={(e) => set("floor", e.target.value ? Number(e.target.value) : null)} placeholder="např. 3" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Rok výstavby</label>
              <input type="number" min={1500} max={2100} value={fields.yearBuilt ?? ""} onChange={(e) => set("yearBuilt", e.target.value ? Number(e.target.value) : null)} placeholder="např. 1985" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Inzerovaná cena (Kč)</label>
              <input type="number" value={fields.askingPrice ?? ""} onChange={(e) => set("askingPrice", e.target.value ? Number(e.target.value) : null)} placeholder="např. 4500000" className={inputCls} />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls}>Adresa (nepovinné)</label>
              <input value={fields.address ?? ""} onChange={(e) => set("address", e.target.value || null)} placeholder="Ulice, číslo popisné…" className={inputCls} />
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 mt-4">{error}</p>
          )}

          <div className="flex items-center gap-3 mt-6">
            <Button onClick={onEstimate} disabled={!canEstimate || estimating} className="min-w-[180px]">
              {estimating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Počítám odhad…
                </>
              ) : (
                "Vytvořit odhad"
              )}
            </Button>
            {!canEstimate && <p className="text-xs text-muted">Doplňte lokalitu a plochu</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
