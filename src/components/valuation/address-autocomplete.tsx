"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, CheckCircle, MagnifyingGlass } from "@phosphor-icons/react";
import type { AddressSuggestion } from "@/lib/geocode";

interface Props {
  value: string;
  /** cityKey z formuláře — přidá se k dotazu (návrhy se vyfiltrují na vybranou lokalitu). */
  cityKey?: string | null;
  /** Ruční editace textu (rodič zneplatní staré GPS). */
  onChange: (address: string) => void;
  /** Výběr návrhu z nabídky — rodič uloží adresu + GPS + hinty na čtvrť. */
  onSelect: (s: AddressSuggestion) => void;
  /** Zda je aktuální adresa spojená s GPS souřadnicemi (badge). */
  hasGps: boolean;
  placeholder?: string;
  className?: string;
}

const inputCls =
  "w-full rounded-xl border border-border/50 bg-card px-3 py-2 pr-9 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow";

export default function AddressAutocomplete({
  value,
  cityKey,
  onChange,
  onSelect,
  hasGps,
  placeholder,
  className = "",
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Poslední vybraný návrh — po výběru nechceme znovu otvírat dropdown pro celou adresu
  const lastPickedRef = useRef<string | null>(null);
  const listboxId = useRef(`addr-list-${Math.random().toString(36).slice(2, 8)}`);

  // Debounce + fetch návrhů
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    // Po výběru návrhu se value rovná zvolené adrese — dál už nehledáme (dropdown by se znovu otevřel)
    if (q.length < 3 || (lastPickedRef.current != null && q === lastPickedRef.current)) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const id = ++reqIdRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (cityKey) params.set("cityKey", cityKey);
        const res = await fetch(`/api/geocode/suggest?${params.toString()}`);
        const data = (await res.json()) as { suggestions?: AddressSuggestion[] };
        // ignorujeme zastaralé odpovědi (rychlé psaní)
        if (id !== reqIdRef.current) return;
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setActive(0);
        // Dropdown otevřeme jen když je input skutečně fokusovaný (např. po URL parse se neotevírá sám)
        setOpen(list.length > 0 && document.activeElement === inputRef.current);
      } catch {
        if (id !== reqIdRef.current) return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (id === reqIdRef.current) setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, cityKey]);

  // Zavření po kliknutí mimo
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (s: AddressSuggestion) => {
    lastPickedRef.current = s.address;
    setOpen(false);
    setSuggestions([]);
    onSelect(s);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Ulice, číslo popisné…"}
        className={inputCls}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId.current}
        aria-activedescendant={open && suggestions[active] ? `${listboxId.current}-${active}` : undefined}
        aria-autocomplete="list"
      />
      {/* indikátor hledání / GPS */}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        {loading ? (
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-accent/40 border-t-accent" />
        ) : hasGps ? (
          <CheckCircle size={17} weight="fill" className="text-emerald-400" />
        ) : (
          <MagnifyingGlass size={17} className="text-muted" />
        )}
      </span>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId.current}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border/50 bg-popover shadow-xl shadow-black/40 backdrop-blur"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.lat},${s.lng}-${s.label}`}>
              <button
                type="button"
                role="option"
                id={`${listboxId.current}-${i}`}
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault(); // před blur — klik se stihne vyhodnotit
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                  i === active ? "bg-accent/10" : ""
                }`}
              >
                <MapPin size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{s.label}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {s.city ?? "—"} · GPS {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                    {s.wardHints.length > 0 ? ` · čtvrť: ${s.wardHints.join(", ")}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
