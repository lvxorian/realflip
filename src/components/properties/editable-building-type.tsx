"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { buildingTypeLabel } from "@/lib/utils";

interface EditableBuildingTypeProps {
  propertyId: string;
  buildingType: string | null;
  editing: boolean;
  onStartEdit: () => void;
  onClose: () => void;
}

const BUILDING_TYPE_OPTIONS = ["brick", "panel", "new", "mixed"] as const;

export function EditableBuildingType({ propertyId, buildingType, editing, onStartEdit, onClose }: EditableBuildingTypeProps) {
  const router = useRouter();
  const [value, setValue] = useState(buildingType ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value) {
      toast.error("Vyberte konstrukci nemovitosti");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingType: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Uložení konstrukce se nezdařilo");
        return;
      }
      toast.success("Konstrukce upravena — analýza přepočtena");
      onClose();
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setValue(buildingType ?? "");
    onStartEdit();
  }

  if (editing) {
    return (
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-1.5">
        <select
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onClose();
          }}
          className="w-full min-w-0 max-w-full sm:w-auto rounded-md border border-accent/50 bg-card px-2 py-0.5 text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {BUILDING_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {buildingTypeLabel(t)}
            </option>
          ))}
        </select>
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
    <button
      type="button"
      onClick={startEdit}
      title="Kliknutím upravit konstrukci"
      className="cursor-pointer font-semibold text-foreground font-mono rounded-lg px-1.5 py-0.5 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent transition-colors hover:from-accent/25 hover:text-accent"
    >
      {buildingTypeLabel(buildingType)}
    </button>
  );
}
