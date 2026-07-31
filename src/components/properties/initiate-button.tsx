"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitBranch } from "@phosphor-icons/react";

interface InitiateButtonProps {
  propertyId: string;
}

export function InitiateButton({ propertyId }: InitiateButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInitiate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/initiate`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.leadId) {
        setError(data?.error ?? "Nepodařilo se zahájit jednání");
        return;
      }
      setSaved(true);
    } catch {
      setError("Chyba sítě");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-center">
        <p className="text-sm text-success font-medium">✅ Přidáno do pipeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleInitiate} disabled={saving} className="w-full" size="lg">
        <GitBranch weight="duotone" />
        {saving ? "Vytvářím..." : "Zahájit jednání"}
      </Button>
      {error && <p className="text-xs text-danger text-center">{error}</p>}
    </div>
  );
}
