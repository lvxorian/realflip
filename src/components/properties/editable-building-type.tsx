"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Check, X, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { buildingTypeLabel } from "@/lib/utils";

interface EditableBuildingTypeProps {
  propertyId: string;
  buildingType: string | null;
}

const BUILDING_TYPE_OPTIONS = ["brick", "panel", "new", "mixed"] as const;

export function EditableBuildingType({ propertyId, buildingType }: EditableBuildingTypeProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setValue(buildingType ?? "");
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="rounded-md border border-accent/50 bg-card px-2 py-0.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {BUILDING_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {buildingTypeLabel(t)}
            </option>
          ))}
        </select>
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
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-semibold text-foreground mt-0.5">{buildingTypeLabel(buildingType)}</span>
      <button
        onClick={startEdit}
        title="Upravit konstrukci"
        className="p-1 rounded-md text-muted/60 hover:text-accent hover:bg-card-hover transition-colors"
      >
        <PencilSimple size={13} weight="bold" />
      </button>
    </div>
  );
}
