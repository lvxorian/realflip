"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Check, X, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

interface EditableFloorProps {
  propertyId: string;
  floor: number | null;
}

export function EditableFloor({ propertyId, floor }: EditableFloorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(floor?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    let next: number | null = null;
    if (trimmed !== "") {
      const num = Number(trimmed.replace(/\s/g, "").replace(/,/g, "."));
      if (!Number.isInteger(num) || num < 0) {
        toast.error("Zadejte platné podlaží");
        return;
      }
      next = num;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floor: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Uložení patra se nezdařilo");
        return;
      }
      toast.success("Patro upraveno — analýza přepočtena");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setValue(floor?.toString() ?? "");
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-16 rounded-md border border-accent/50 bg-card px-2 py-0.5 text-sm font-semibold text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
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
      <span className="font-semibold text-foreground font-mono text-center">
        {floor != null ? `${floor}.` : "—"}
      </span>
      <button
        onClick={startEdit}
        title="Upravit patro"
        className="p-1 rounded-md text-muted/60 hover:text-accent hover:bg-card-hover transition-colors"
      >
        <PencilSimple size={13} weight="bold" />
      </button>
    </div>
  );
}
