"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Handshake, WarningCircle, ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOST_REASONS, LEAD_STAGES } from "@/lib/leads";
import { closedDealPrefill } from "@/lib/pipeline-modal";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import type { LeadItem } from "./types";

export type StageAction = "closed" | "lost" | "reopen";

const labelClass = "text-xs text-muted block mb-1";
const inputClass =
  "w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-sm focus:outline-none focus:border-accent/50 transition-colors font-mono";

export function StageTransitionModal({
  action,
  lead,
  onCancel,
  onMarkLost,
  onConvert,
  onCloseOnly,
  onReopen,
}: {
  action: StageAction | null;
  lead: LeadItem | null;
  onCancel: () => void;
  onMarkLost: (reason: string) => void;
  onConvert: (purchasePrice: number, renovationBudget: number | null, investorId: string | null) => void;
  onCloseOnly: () => void;
  onReopen: () => void;
}) {
  const [lostReason, setLostReason] = useState("");
  const [price, setPrice] = useState(() =>
    action === "closed" && lead && closedDealPrefill(lead) > 0 ? String(closedDealPrefill(lead)) : ""
  );
  const [renovation, setRenovation] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [investors, setInvestors] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d: { id: string; name: string }[]) => {
        if (Array.isArray(d)) {
          setInvestors(d);
          const reserved = lead?.portalReservedInvestorId;
          if (reserved && d.some((i) => i.id === reserved)) setInvestorId(reserved);
        }
      })
      .catch(() => {});
  }, [lead?.portalReservedInvestorId]);

  const reopenStageLabel = lead ? (LEAD_STAGES.find((s) => s.key === lead.stage)?.label ?? lead.stage) : "";
  const isLoss = action === "lost";
  const isClosed = action === "closed";
  const isReopen = action === "reopen";

  function handleConvert() {
    const p = parseInt(price, 10);
    if (!Number.isFinite(p) || p <= 0) {
      toast.error("Zadejte platnou kupní cenu");
      return;
    }
    setBusy(true);
    onConvert(p, parseInt(renovation, 10) || null, investorId || null);
  }

  function handleLost() {
    if (!lostReason) {
      toast.error("Vyberte důvod, proč je lead ztracený");
      return;
    }
    setBusy(true);
    onMarkLost(lostReason);
  }

  return (
    <AnimatePresence>
      {action && lead && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={busy ? undefined : onCancel}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border/50 bg-background shadow-2xl shadow-black/50"
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isLoss ? "bg-red-500/10 text-red-400" : isClosed ? "bg-emerald-500/10 text-emerald-400" : "bg-accent/10 text-accent"
                    }`}
                  >
                    {isLoss ? <WarningCircle size={15} weight="bold" /> : isClosed ? <Handshake size={15} weight="bold" /> : <ArrowCounterClockwise size={15} weight="bold" />}
                  </span>
                  <h3 className="text-sm font-semibold truncate">
                    {isLoss ? "Označit jako ztraceno" : isClosed ? "Uzavřít deal" : "Vrátit do pipeline"}
                  </h3>
                </div>
                <button onClick={busy ? undefined : onCancel} className="p-1.5 rounded-lg hover:bg-card text-muted transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <p className="text-xs text-muted break-words">
                  {lead.propertyTitle ?? "Nemovitost"}
                </p>

                {isClosed && (
                  <>
                    <div>
                      <label className={labelClass}>
                        Kupní cena
                        {lead.stageData?.negotiation?.currentAmount != null && (
                          <span className="text-muted/60 ml-1">(vyjednáno: {formatPrice(lead.stageData.negotiation.currentAmount)})</span>
                        )}
                      </label>
                      <Input
                        type="amount"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Rozpočet na reko</label>
                      <Input
                        type="amount"
                        value={renovation}
                        onChange={(e) => setRenovation(e.target.value)}
                        placeholder="např. 500 000"
                      />
                    </div>
                    <div>
                      <label className={labelClass + " cursor-pointer"}>Investor</label>
                      <select value={investorId} onChange={(e) => setInvestorId(e.target.value)} className={inputClass + " cursor-pointer"}>
                        <option value="">Sám financuji</option>
                        {investors.map((inv) => (
                          <option key={inv.id} value={inv.id}>{inv.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {isLoss && (
                  <div>
                    <label className={labelClass}>Důvod</label>
                    <select
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      className={"w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-sm focus:outline-none focus:border-accent/50 cursor-pointer"}
                    >
                      <option value="">Vyberte důvod...</option>
                      {LOST_REASONS.map((r) => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted mt-1.5 flex items-center gap-1">
                      <WarningCircle size={11} className="text-amber-400/80 shrink-0" />
                      Důvod se uloží do historie leadu.
                    </p>
                  </div>
                )}

                {isReopen && (
                  <p className="text-xs text-muted leading-relaxed">
                    Přesunete lead zpět do fáze <span className="text-foreground font-medium">„{reopenStageLabel}“</span>.
                    Tím se znovu aktivuje v pipeline a započne se počítat čas ve fázi.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 px-5 pb-5">
                {isClosed ? (
                  <>
                    <Button variant="secondary" onClick={busy ? undefined : onCloseOnly} disabled={busy} className="flex-1">
                      Jen uzavřít
                    </Button>
                    <Button onClick={handleConvert} disabled={busy} className="flex-1 gap-1.5">
                      <Check size={14} weight="bold" /> {busy ? "Převádím..." : "Převést na deal"}
                    </Button>
                  </>
                ) : isLoss ? (
                  <>
                    <Button variant="secondary" onClick={busy ? undefined : onCancel} disabled={busy} className="flex-1">
                      Zrušit
                    </Button>
                    <Button onClick={handleLost} disabled={busy} className="flex-1 gap-1.5" variant="default">
                      <Check size={14} weight="bold" /> {busy ? "Ukládám..." : "Označit jako ztraceno"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" onClick={busy ? undefined : onCancel} disabled={busy} className="flex-1">
                      Zrušit
                    </Button>
                    <Button onClick={busy ? undefined : onReopen} disabled={busy} className="flex-1 gap-1.5">
                      <ArrowCounterClockwise size={14} weight="bold" /> Vrátit zpět
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}