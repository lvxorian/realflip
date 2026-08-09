"use client";

import { MagnifyingGlass, X, ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { cn, CONDITION_LABELS } from "@/lib/utils";
import { LEAD_STAGES } from "@/lib/leads";
import type { LeadItem } from "./types";

export interface LeadFilterState {
  query: string;
  stage: string;
  portal: string;
  condition: string;
  priority: string;
  sort: string;
}

export const INITIAL_LEAD_FILTERS: LeadFilterState = {
  query: "",
  stage: "",
  portal: "",
  condition: "",
  priority: "",
  sort: "activity",
};

const SORT_OPTIONS = [
  { key: "activity", label: "Nejnovější aktivita" },
  { key: "price-desc", label: "Cena sestupně" },
  { key: "price-asc", label: "Cena vzestupně" },
  { key: "score-desc", label: "Skóre sestupně" },
];

function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-lg border border-border/50 bg-card px-2.5 text-xs text-foreground cursor-pointer",
        "focus:outline-none focus:border-accent/50 transition-colors",
        !value && "text-muted/60",
        className
      )}
    >
      {children}
    </select>
  );
}

export function LeadsToolbar({
  leads,
  visible,
  filters,
  onChange,
}: {
  leads: LeadItem[];
  visible: number;
  filters: LeadFilterState;
  onChange: (filters: LeadFilterState) => void;
}) {
  const portals = Array.from(new Set(leads.map((l) => l.propertyPortalName).filter(Boolean))).sort() as string[];
  const hasActive =
    filters.query !== "" ||
    filters.stage !== "" ||
    filters.portal !== "" ||
    filters.condition !== "" ||
    filters.priority !== "" ||
    filters.sort !== "activity";

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Hledat název, adresu, kontakt, telefon..."
            className="h-9 w-full rounded-lg border border-border/50 bg-background/50 pl-9 pr-8 text-xs placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
          />
          {filters.query && (
            <button
              onClick={() => onChange({ ...filters, query: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted/50 hover:text-muted"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <Select value={filters.stage} onChange={(v) => onChange({ ...filters, stage: v })}>
          <option value="">Fáze: vše</option>
          {LEAD_STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </Select>

        <Select value={filters.portal} onChange={(v) => onChange({ ...filters, portal: v })}>
          <option value="">Všechny portály</option>
          {portals.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>

        <Select value={filters.condition} onChange={(v) => onChange({ ...filters, condition: v })}>
          <option value="">Stav: vše</option>
          {Object.entries(CONDITION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>

        <Select value={filters.priority} onChange={(v) => onChange({ ...filters, priority: v })}>
          <option value="">Priorita: vše</option>
          <option value="1">Nízká</option>
          <option value="2">Střední</option>
          <option value="3">Vysoká</option>
        </Select>

        <Select value={filters.sort} onChange={(v) => onChange({ ...filters, sort: v })}>
          {SORT_OPTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </Select>

        <span className="flex items-center gap-1.5 rounded-lg bg-border/20 px-2.5 h-9 text-[11px] text-muted font-mono whitespace-nowrap">
          {visible}/{leads.length}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted/60">
          <span>
            {LEAD_STAGES.length} fází · {leads.length} leadů
          </span>
        </div>
        <button
          onClick={() => onChange(INITIAL_LEAD_FILTERS)}
          disabled={!hasActive}
          className={cn(
            "text-[11px] flex items-center gap-1 transition-colors",
            hasActive ? "text-accent hover:text-accent/80" : "text-muted/40 cursor-default"
          )}
        >
          <X size={11} /> Vymazat filtry
        </button>
      </div>

      {filters.sort === "price-asc" || filters.sort === "price-desc" ? (
        <div className="flex items-center gap-1 text-[10px] text-muted/50">
          {filters.sort === "price-desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
          Řazeno podle ceny — přetáhněte karty pro ruční uspořádání
        </div>
      ) : null}
    </div>
  );
}