"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, WarningCircle, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { LeadItem } from "./types";

/**
 * Potvrzovací modal pro trvalé odstranění leadu z pipeline (mimo „Ztraceno“).
 * Sdílený z hover akcí karty i danger zóny v draweru — akce je nevratná,
 * proto se uživatel dopředu upozorní na ztrátu záznamů o leadu.
 * Nemovitost se neodstraňuje — jen lead z pipeline.
 */
export function DeleteLeadModal({
  lead,
  deleting,
  onCancel,
  onConfirm,
}: {
  lead: LeadItem | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {lead && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={deleting ? undefined : onCancel}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-danger/30 bg-background shadow-2xl shadow-black/50"
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                    <WarningCircle size={15} weight="bold" />
                  </span>
                  <h3 className="text-sm font-semibold truncate">Odstranit lead z pipeline?</h3>
                </div>
                <button
                  onClick={deleting ? undefined : onCancel}
                  className="p-1.5 rounded-lg hover:bg-card text-muted transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-foreground/90 leading-relaxed">
                  <span className="font-semibold">{lead.propertyTitle ?? "Nemovitost"}</span> se trvale
                  odstraní z pipeline.
                </p>
                <ul className="space-y-1.5 text-xs text-muted leading-relaxed list-disc pl-4">
                  <li>
                    Ztratíte všechny záznamy o tomto leadu — historii, poznámky, fáze, nabídky a další kroky.
                  </li>
                  <li>Nemovitost zůstane v databázi — neodstraňuje se.</li>
                  {lead.dealId && <li>Deal v Portfoliu zůstane zachován.</li>}
                </ul>
                <p className="text-[10px] text-red-400/80 flex items-center gap-1.5">
                  <WarningCircle size={11} className="shrink-0" />
                  Tuto akci nelze vrátit zpět.
                </p>
              </div>

              <div className="flex items-center gap-2 px-5 pb-5">
                <Button
                  variant="secondary"
                  onClick={deleting ? undefined : onCancel}
                  disabled={deleting}
                  className="flex-1"
                >
                  Zrušit
                </Button>
                <Button
                  variant="danger"
                  onClick={onConfirm}
                  disabled={deleting}
                  className="flex-1 gap-1.5"
                >
                  <Trash size={14} weight="bold" />
                  {deleting ? "Odstraňuji..." : "Odstranit"}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
