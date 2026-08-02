"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Check, X, LockSimple, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

interface EditableAreaProps {
  propertyId: string;
  area: number | null;
  areaLocked: boolean;
}

export function EditableArea({ propertyId, area, areaLocked }: EditableAreaProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setValue(area?.toString() ?? "");
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-20 rounded-md border border-accent/50 bg-card px-2 py-0.5 text-sm font-semibold text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <span className="text-xs text-muted">m²</span>
        <button
          onClick={save}
          disabled={saving}
          className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors"
        >
          {saving ? <Spinner size={14} className="animate-spin" /> : <Check size={14} weight="bold" />}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="p-1 rounded-md text-muted hover:bg-card-hover transition-colors"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-foreground font-mono mt-0.5">
        {area ? `${area} m²` : "—"}
      </span>
      <button
        onClick={startEdit}
        title="Upravit plochu"
        className="p-1 rounded-md text-muted/60 hover:text-accent hover:bg-card-hover transition-colors"
      >
        <PencilSimple size={13} weight="bold" />
      </button>
      {areaLocked && (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400 font-medium" title="Plocha upravena ručně — scraper ji nepřepíše">
          <LockSimple size={10} weight="fill" /> ručně
        </span>
      )}
    </div>
  );
}
