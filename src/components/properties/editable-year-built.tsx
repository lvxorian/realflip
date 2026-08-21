"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

interface EditableYearBuiltProps {
  propertyId: string;
  yearBuilt: number | null;
  editing: boolean;
  onStartEdit: () => void;
  onClose: () => void;
}

export function EditableYearBuilt({ propertyId, yearBuilt, editing, onStartEdit, onClose }: EditableYearBuiltProps) {
  const router = useRouter();
  const [value, setValue] = useState(yearBuilt?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    let next: number | null = null;
    if (trimmed !== "") {
      const num = Number(trimmed.replace(/\s/g, "").replace(/,/g, "."));
      if (!Number.isInteger(num) || num < 1800 || num > 2030) {
        toast.error("Zadejte platný rok výstavby");
        return;
      }
      next = num;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearBuilt: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Uložení roku se nezdařilo");
        return;
      }
      toast.success("Rok upraven — analýza přepočtena");
      onClose();
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setValue(yearBuilt?.toString() ?? "");
    onStartEdit();
  }

  if (editing) {
    return (
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-1.5">
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onClose();
          }}
          className="w-full min-w-0 sm:w-16 rounded-md border border-accent/50 bg-card px-2 py-0.5 text-sm font-semibold text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
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
      title="Kliknutím upravit rok"
      className="cursor-pointer font-semibold text-foreground font-mono rounded-lg px-1.5 py-0.5 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent transition-colors hover:from-accent/25 hover:text-accent"
    >
      {yearBuilt ?? "—"}
    </button>
  );
}
