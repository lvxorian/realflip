"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Check, X, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { conditionLabel } from "@/lib/utils";

interface EditableConditionProps {
  propertyId: string;
  condition: string | null;
}

const CONDITION_OPTIONS = ["dilapidated", "original", "good", "renovated", "new"] as const;

export function EditableCondition({ propertyId, condition }: EditableConditionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(condition ?? "good");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value) {
      toast.error("Vyberte stav nemovitosti");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Uložení stavu se nezdařilo");
        return;
      }
      toast.success("Stav upraven — analýza přepočtena");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setValue(condition ?? "good");
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
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
          {CONDITION_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {conditionLabel(c)}
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
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5">
      <span aria-hidden="true" />
      <span className="font-semibold text-foreground font-mono text-center">{conditionLabel(condition)}</span>
      <button
        onClick={startEdit}
        title="Upravit stav"
        className="p-1 rounded-md text-muted/60 hover:text-accent hover:bg-card-hover transition-colors"
      >
        <PencilSimple size={13} weight="bold" />
      </button>
    </div>
  );
}