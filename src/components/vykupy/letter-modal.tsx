"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "@phosphor-icons/react";

interface LetterModalProps {
  open: boolean;
  onClose: () => void;
  debtorName: string;
  caseNumber: string;
  address: string | null;
}

export function LetterModal({ open, onClose, debtorName, caseNumber, address }: LetterModalProps) {
  const [copied, setCopied] = useState(false);

  const date = new Date().toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const letter = `Vážený/á ${debtorName},

obraťte se na nás, prosím, v souvislosti s dražbou vedenou pod sp. zn. ${caseNumber}${address ? `, týkající se nemovitosti v ${address}` : ""}.

Máme vážný zájem o odkup Vaší nemovitosti a jsme připraveni jednat rychle a bez zbytečných průtahů.

Nabízíme:
- Rychlý odkup za férovou cenu
- Bez nutnosti oprav a úprav
- Právní servis na naše náklady
- Diskrétní jednání

Kontaktujte nás prosím na uvedeném telefonu nebo e-mailu.

S pozdravem,
RealFlip Pro

---
Tento dopis je nezávaznou nabídkou a není právním dokumentem.
Vygenerováno: ${date}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

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
            className="bg-card rounded-2xl border border-border/50 w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border/30">
              <h2 className="font-semibold tracking-tight">Oslovovací dopis</h2>
              <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-card-hover flex items-center justify-center transition-colors">
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                {letter}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-border/30">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={16} weight="bold" />
                    Zkopírováno
                  </>
                ) : (
                  <>
                    <Copy size={16} weight="bold" />
                    Zkopírovat do schránky
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-card px-5 py-2.5 text-sm font-medium text-foreground/80 hover:bg-card-hover transition-colors"
              >
                Zavřít
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
