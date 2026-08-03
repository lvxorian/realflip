"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    type: string;
    tags: string;
    notes: string | null;
  }) => void;
}

const CONTACT_TYPES = [
  { value: "agent", label: "Makléř" },
  { value: "owner", label: "Majitel" },
  { value: "debtor", label: "Dlužník" },
];

export function AddContactModal({ open, onClose, onCreated }: AddContactModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("owner");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setType("owner");
    setNotes("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Zadejte jméno kontaktu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          type,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setError(data.error || "Vytvoření kontaktu se nezdařilo");
        return;
      }
      toast.success("Kontakt vytvořen");
      onCreated?.(data);
      reset();
      onClose();
    } catch {
      setError("Chyba sítě — zkontrolujte připojení");
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
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl border border-border/50 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h2 className="font-semibold tracking-tight">Nový kontakt</h2>
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
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Typ</label>
                  <div className="flex flex-wrap gap-2">
                    {CONTACT_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          type === t.value
                            ? "bg-accent text-white"
                            : "bg-card text-foreground border border-border hover:bg-card-hover"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
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

              <div className="flex justify-end gap-2 p-5 border-t border-border/30">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Zrušit
                </Button>
                <Button type="submit" loading={saving} className="gap-1.5">
                  <Check size={14} weight="bold" />
                  {saving ? "Ukládám..." : "Vytvořit kontakt"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
