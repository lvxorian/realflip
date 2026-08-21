"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, LockSimple, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

interface EditableAreaProps {
  propertyId: string;
  area: number | null;
  areaLocked: boolean;
  areaFlag?: string | null;
  accessoryArea?: number | null;
  editing: boolean;
  onStartEdit: () => void;
  onClose: () => void;
}

const FLAG_META: Record<string, { label: string; title: string; className: string }> = {
  "invalid-small": {
    label: "plocha podezřelá",
    title: "Zadaná plocha menší než 15 m² — pravděpodobně jen sklep/garáž. Použita větší hodnota.",
    className: "bg-red-500/10 border-red-500/20 text-red-400",
  },
  "extreme-diff": {
    label: "kontrola",
    title: "Extrémní rozdíl mezi podlahovou a užitnou plochou (např. 20 vs 150 m²) — zkontrolujte manuálně.",
    className: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
};

export function EditableArea({ propertyId, area, areaLocked, areaFlag, accessoryArea, editing, onStartEdit, onClose }: EditableAreaProps) {
  const router = useRouter();
  const [value, setValue] = useState(area?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const num = parseFloat(value.replace(/\s/g, "").replace(/,/g, "."));
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Zadejte platnou plochu v m²");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: num }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Uložení plochy se nezdařilo");
        return;
      }
      toast.success("Plocha upravena — analýza přepočtena");
      onClose();
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setValue(area?.toString() ?? "");
    onStartEdit();
  }

  if (editing) {
    return (
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-1.5">
        <div className="w-full sm:w-auto flex items-center justify-center gap-1">
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") onClose();
            }}
            className="w-full min-w-0 sm:w-20 rounded-md border border-accent/50 bg-card px-2 py-0.5 text-sm font-semibold text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <span className="text-xs text-muted">m²</span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={save}
            disabled={saving}
            className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            {saving ? <Spinner size={14} className="animate-spin" /> : <Check size={14} weight="bold" />}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded-md text-muted hover:bg-card-hover transition-colors"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={startEdit}
        title="Kliknutím upravit plochu"
        className="font-semibold text-foreground font-mono rounded-lg px-1.5 py-0.5 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent transition-colors hover:from-accent/25 hover:text-accent"
      >
        {area ? `${area} m²` : "—"}
      </button>
      {(accessoryArea != null && accessoryArea > 0) || areaLocked || (areaFlag && FLAG_META[areaFlag]) ? (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {accessoryArea != null && accessoryArea > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-accent/10 border border-accent/20 px-1.5 py-0.5 text-[10px] text-accent font-medium" title="Odhad plochy příslušenství (terasa/balkon/lodžie/sklep) z rozdílu podlahové a užitné plochy">
              +{accessoryArea} m² příslušenství
            </span>
          )}
          {areaLocked && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400 font-medium" title="Plocha upravena ručně — scraper ji nepřepíše">
              <LockSimple size={10} weight="fill" /> ručně
            </span>
          )}
          {areaFlag && FLAG_META[areaFlag] && (
            <span className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${FLAG_META[areaFlag].className}`} title={FLAG_META[areaFlag].title}>
              ⚠ {FLAG_META[areaFlag].label}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
