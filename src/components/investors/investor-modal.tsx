"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash, Infinity as InfinityIcon, LockSimple, User, Password } from "@phosphor-icons/react";
import { deriveInvestorCredentials } from "@/lib/investor-credentials";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface InvestorFormValue {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  budget: number | null;
  budgetUnlimited: number | null;
  portalEnabled?: number | null;
  notes: string | null;
}

interface InvestorModalProps {
  open: boolean;
  investor?: InvestorFormValue | null;
  onClose: () => void;
  onSaved: (investor: InvestorFormValue) => void;
  onDeleted?: (id: string) => void;
}

export function InvestorModal({ open, investor, onClose, onSaved, onDeleted }: InvestorModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl border border-border/50 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <InvestorModalForm
              key={investor?.id ?? "new"}
              investor={investor ?? null}
              onClose={onClose}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InvestorModalForm({
  investor,
  onClose,
  onSaved,
  onDeleted,
}: {
  investor: InvestorFormValue | null;
  onClose: () => void;
  onSaved: (investor: InvestorFormValue) => void;
  onDeleted?: (id: string) => void;
}) {
  const isEdit = !!investor;
  const [name, setName] = useState(investor?.name ?? "");
  const [city, setCity] = useState(investor?.city ?? "");
  const [phone, setPhone] = useState(investor?.phone ?? "");
  const [email, setEmail] = useState(investor?.email ?? "");
  const [budget, setBudget] = useState(investor?.budget != null ? String(investor.budget) : "");
  const [budgetUnlimited, setBudgetUnlimited] = useState(!!investor?.budgetUnlimited);
  const [portalEnabled, setPortalEnabled] = useState(!!investor?.portalEnabled);
  const [notes, setNotes] = useState(investor?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const creds = deriveInvestorCredentials(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Zadejte jméno investora");
      return;
    }
    const creds = deriveInvestorCredentials(name);
    if (portalEnabled && !creds.password) {
      setError("Pro přístup k portálu zadejte jméno i příjmení investora");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        city: city.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        budget: budgetUnlimited ? null : budget.trim() ? parseInt(budget.replace(/\s/g, ""), 10) : null,
        budgetUnlimited: budgetUnlimited ? 1 : 0,
        portalEnabled: portalEnabled ? 1 : 0,
        notes: notes.trim() || null,
      };
      const res = await fetch(
        isEdit ? `/api/investors/${investor!.id}` : "/api/investors",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Uložení investora se nezdařilo");
        return;
      }
      toast.success(isEdit ? "Investor upraven" : "Investor vytvořen");
      const saved: InvestorFormValue = {
        id: isEdit ? investor!.id : data.id,
        name: payload.name,
        city: payload.city,
        phone: payload.phone,
        email: payload.email,
        budget: payload.budget,
        budgetUnlimited: payload.budgetUnlimited,
        portalEnabled: payload.portalEnabled,
        notes: payload.notes,
      };
      onSaved(saved);
      onClose();
    } catch {
      setError("Chyba sítě — zkontrolujte připojení");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!investor || !onDeleted) return;
    if (!confirm(`Opravdu chcete smazat investora ${investor.name}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/investors/${investor.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Smazání se nezdařilo");
        return;
      }
      toast.success("Investor smazán");
      onDeleted(investor.id);
      onClose();
    } catch {
      toast.error("Smazání se nezdařilo");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between p-5 border-b border-border/30">
        <h2 className="font-semibold tracking-tight">{isEdit ? "Upravit investora" : "Nový investor"}</h2>
        <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-card-hover flex items-center justify-center transition-colors">
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <Input
          label="Jméno *"
          placeholder="např. Jan Novák"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Město bydliště"
          placeholder="např. Praha"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Telefon"
            placeholder="+420 ..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="jan@example.cz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80 flex items-center justify-between">
            Budget pro spolupráci
            <button
              type="button"
              onClick={() => setBudgetUnlimited(!budgetUnlimited)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                budgetUnlimited
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-card text-muted border-border hover:bg-card-hover"
              }`}
            >
              <InfinityIcon size={13} weight={budgetUnlimited ? "fill" : "regular"} />
              Neomezeno
            </button>
          </label>
          <Input
            type="number"
            min={0}
            placeholder="např. 5000000"
            value={budget}
            disabled={budgetUnlimited}
            onChange={(e) => setBudget(e.target.value)}
          />
          {budgetUnlimited && (
            <p className="text-xs text-muted">Investor nemá horní limit — budget se nehlídá.</p>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card-hover/30 p-4 space-y-3">
          <button
            type="button"
            onClick={() => setPortalEnabled(!portalEnabled)}
            className="w-full flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              <LockSimple size={16} weight="bold" className={portalEnabled ? "text-accent" : "text-muted"} />
              Přístup k portálu investorů
            </span>
            <span
              className={`flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors ${
                portalEnabled ? "justify-end bg-accent/30 border-accent/40" : "justify-start bg-card border-border"
              }`}
            >
              <span className={`h-5 w-5 rounded-full transition-colors ${portalEnabled ? "bg-accent" : "bg-muted/40"}`} />
            </span>
          </button>
          {portalEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-2"
            >
              {creds.password ? (
                <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <User size={12} weight="bold" className="shrink-0" />
                    Přihlašovací jméno:
                    <span className="font-mono font-semibold text-foreground">{creds.username}</span>
                  </p>
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <Password size={12} weight="bold" className="shrink-0" />
                    Heslo:
                    <span className="font-mono font-semibold text-foreground">{creds.password}</span>
                  </p>
                  <p className="text-[11px] text-muted/80">
                    Investor se přihlásí na{" "}
                    {process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL || "brickon.vercel.app"}
                    /investor. Údaje se odvozují od jména — bez diakritiky, malými písmeny.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-danger flex items-start gap-1.5">
                  <Password size={12} weight="bold" className="shrink-0 mt-0.5" />
                  Pro zapnutí portálu je třeba jméno i příjmení — z nich se odvodí přihlašovací údaje.
                </p>
              )}
            </motion.div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground/80 block mb-1.5">Poznámky (volitelné)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Stručná poznámka..."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 p-5 border-t border-border/30">
        {isEdit && onDeleted ? (
          <Button type="button" variant="secondary" onClick={handleDelete} loading={deleting} className="text-danger gap-1.5">
            <Trash size={14} weight="bold" />
            Smazat
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="submit" loading={saving} className="gap-1.5">
            <Check size={14} weight="bold" />
            {saving ? "Ukládám..." : isEdit ? "Uložit změny" : "Vytvořit investora"}
          </Button>
        </div>
      </div>
    </form>
  );
}
