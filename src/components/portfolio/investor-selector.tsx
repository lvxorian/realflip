"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const labelClass = "text-xs text-muted block mb-1";
const selectClass =
  "w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-sm focus:outline-none focus:border-accent/50 transition-colors";

export function InvestorSelector({ dealId, currentInvestorId }: { dealId: string; currentInvestorId: string | null }) {
  const router = useRouter();
  const [investors, setInvestors] = useState<{ id: string; name: string }[]>([]);
  const [value, setValue] = useState(currentInvestorId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d: { id: string; name: string }[]) => {
        if (Array.isArray(d)) setInvestors(d);
      })
      .catch(() => {});
  }, []);

  async function save(next: string) {
    setValue(next);
    if (next === (currentInvestorId ?? "")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId: next || null }),
      });
      if (!res.ok) {
        toast.error("Uložení investora se nezdařilo");
        setValue(currentInvestorId ?? "");
        return;
      }
      toast.success(next ? "Investor přiřazen" : "Projekt nyní financujete sami");
      router.refresh();
    } catch {
      toast.error("Uložení se nezdařilo");
      setValue(currentInvestorId ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className={labelClass}>Změnit financování</label>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => save(e.target.value)}
        className={selectClass}
      >
        <option value="">Sám financuji</option>
        {investors.map((inv) => (
          <option key={inv.id} value={inv.id}>{inv.name}</option>
        ))}
      </select>
    </div>
  );
}
