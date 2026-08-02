"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

export function DeletePropertyButton({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        "Opravdu chcete odstranit tuto nemovitost z databáze?\n\nPozor: smažou se i navázané leady, dealy, analýza a historie ceny. Tuto akci nelze vrátit."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Odstranění se nezdařilo");
        setDeleting(false);
        return;
      }
      toast.success("Nemovitost odstraněna");
      router.push("/properties");
    } catch {
      toast.error("Chyba sítě");
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors disabled:opacity-50"
    >
      <Trash size={13} weight="bold" />
      {deleting ? "Odstraňuji..." : "Odstranit z databáze"}
    </button>
  );
}
