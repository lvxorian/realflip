"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, EnvelopeSimple, ArrowRight } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { INVESTOR_BRAND } from "@/lib/investor-brand";

interface EmailModalProps {
  open: boolean;
  investorName?: string | null;
  onClose: () => void;
  onSaved: (email: string) => void;
}

export function EmailModal({ open, investorName, onClose, onSaved }: EmailModalProps) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/investor-portal/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) return;
        setError(data.error || "Uložení se nezdařilo.");
        return;
      }
      toast.success("E-mail uložen");
      onSaved(data.email ?? email);
    } catch {
      setError("Chyba sítě — zkontrolujte připojení.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl border border-border/50 w-full max-w-md overflow-hidden"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/25">
                  <EnvelopeSimple size={20} weight="fill" className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold tracking-tight leading-tight">
                    {investorName ? `Vítejte v portálu ${INVESTOR_BRAND}, ${investorName}!` : `Vítejte v portálu ${INVESTOR_BRAND}!`}
                  </h2>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    Přihlaste se k upozorněním na nové nabídky. Jakmile zpřístupníme novou příležitost, dáme vám vědět.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg hover:bg-card-hover flex items-center justify-center transition-colors text-muted"
                  aria-label="Zavřít"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <Input
                  label="E-mail *"
                  type="email"
                  placeholder="jan@example.cz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                    Přeskočit
                  </Button>
                  <Button type="submit" loading={saving} className="flex-1 gap-1.5">
                    <ArrowRight size={14} weight="bold" />
                    Uložit e-mail
                  </Button>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Pokud přeskočíte, zeptáme se znovu při příštím přihlášení. Bez e-mailu vám nabídky posílat nebudeme.
                </p>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}