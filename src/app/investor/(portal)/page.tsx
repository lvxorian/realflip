"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCompactPrice, formatPercent } from "@/lib/utils";
import { EmailModal } from "@/components/investor/email-modal";
import { BrickonLogo } from "@/components/investor/brickon-logo";
import {
  SignOut,
  MapPin,
  CheckCircle,
  CircleNotch,
  HandCoins,
  SealCheck,
  ArrowCounterClockwise,
  WarningCircle,
  EnvelopeSimple,
  Hourglass,
} from "@phosphor-icons/react";
import type { InvestorPortalItem } from "@/lib/investor-portal";
import { INVESTOR_BRAND } from "@/lib/investor-brand";

interface PortalData {
  items: InvestorPortalItem[];
  investorName: string;
  investorBudget: number | null;
  investorBudgetUnlimited: number;
  investorEmail: string | null;
}

function fmtPrice(v: number | null): string {
  return v !== null ? formatCompactPrice(v) : "—";
}

export default function InvestorPortalPage() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const dismissedEmailPrompt = useRef(false);

  const maybePromptEmail = useCallback((json: PortalData) => {
    if (json.investorEmail == null && !dismissedEmailPrompt.current) {
      setEmailModalOpen(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/investor-portal/properties", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/investor/login");
      return false;
    }
    if (!res.ok) {
      setError("Nepodařilo se načíst nabídky.");
      setLoading(false);
      return false;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
    maybePromptEmail(json);
    return true;
  }, [router, maybePromptEmail]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/investor-portal/properties", { cache: "no-store" });
      if (cancelled) return;
      if (res.status === 401) {
        router.replace("/investor/login");
        return;
      }
      if (!res.ok) {
        setError("Nepodařilo se načíst nabídky.");
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
      maybePromptEmail(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, maybePromptEmail]);

  async function toggleReserve(item: InvestorPortalItem) {
    const action = item.status === "reserved" && item.reservedByMe ? "cancel" : "reserve";
    setActionId(item.id);
    setError("");
    try {
      const res = await fetch("/api/investor-portal/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Operace se nepodařila.");
        return;
      }
      await refresh();
    } finally {
      setActionId(null);
    }
  }

  async function toggleWaitlist(item: InvestorPortalItem) {
    setActionId(item.id);
    setError("");
    try {
      const res = await fetch("/api/investor-portal/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: item.waitlisted ? "unwaitlist" : "waitlist" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Operace se nepodařila.");
        return;
      }
      await refresh();
    } finally {
      setActionId(null);
    }
  }

  async function logout() {
    await fetch("/api/investor-portal/logout", { method: "POST" });
    router.replace("/investor/login");
  }

  const available = data?.items.filter((i) => i.status === "available") ?? [];
  const reservedByMe = data?.items.filter((i) => i.status === "reserved" && i.reservedByMe) ?? [];
  const reservedOthers = data?.items.filter((i) => i.status === "reserved" && !i.reservedByMe) ?? [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="bg-grid min-h-[100dvh]">
        <header className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/25">
              <BrickonLogo size={28} tone="brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold tracking-tight leading-none">
                <span className="uppercase">{INVESTOR_BRAND}</span>
                <span className="font-normal text-muted"> · Portál investorů</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-muted truncate">
                  {data?.investorName ?? "Přihlášený investor"}
                  {data && !data.investorBudgetUnlimited && data.investorBudget
                    ? ` · budget ${formatCompactPrice(data.investorBudget)}`
                    : ""}
                </p>
                {data && data.investorEmail == null && (
                  <button
                    type="button"
                    onClick={() => {
                      dismissedEmailPrompt.current = false;
                      setEmailModalOpen(true);
                    }}
                    className="shrink-0 flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/15 transition-colors"
                  >
                    <EnvelopeSimple size={10} weight="bold" />
                    Nastavit e-mail
                  </button>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="shrink-0">
              <SignOut size={14} weight="bold" />
              Odhlásit
            </Button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted gap-3">
              <CircleNotch size={28} className="animate-spin text-accent" />
              <span className="text-sm">Načítám nabídky…</span>
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Dostupné nabídky" value={`${available.length}`} tone="text-emerald-400" icon={<HandCoins size={16} weight="bold" />} />
                <StatCard label="Moje rezervace" value={`${reservedByMe.length}`} tone="text-accent" icon={<SealCheck size={16} weight="bold" />} />
                <StatCard label="Rezervováno ostatními" value={`${reservedOthers.length}`} tone="text-muted" icon={<CheckCircle size={16} weight="bold" />} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { icon: <CheckCircle size={14} weight="bold" />, text: "Nepřetržitý monitoring trhu s prioritními upozorněními" },
                  { icon: <CheckCircle size={14} weight="bold" />, text: "Vyjednané ceny ještě před veřejným zveřejněním" },
                  { icon: <CheckCircle size={14} weight="bold" />, text: "Každá nabídka obsahuje analýzu zisku, ROI i další postup" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border/40 bg-card/60 px-3 py-2.5 flex items-center gap-2 text-[11px] text-muted"
                  >
                    <span className="text-emerald-400 shrink-0">{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-danger rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
                >
                  {error}
                </motion.p>
              )}

              {data.items.length === 0 ? (
                <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-card-hover">
                    <HandCoins size={24} weight="bold" className="text-muted" />
                  </div>
                  <p className="text-sm text-foreground/90 font-medium">Aktuálně nejsou k dispozici žádné nabídky.</p>
                  <p className="text-xs text-muted mt-1">Nová prověřená nabídka se objeví zde. Jakmile budeme mít připravenou další příležitost, dáme vám vědět.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden lg:block rounded-2xl border border-border/50 bg-card overflow-hidden">
                    <table className="w-full text-[13px] leading-tight">
                      <thead>
                        <tr className="border-b border-border/30 bg-card-elevated/40">
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-medium whitespace-nowrap">Nabídka</th>
                          <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wider text-muted font-medium whitespace-nowrap">Inzerovaná cena</th>
                          <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wider text-muted font-medium whitespace-nowrap">Cena po vyjednání</th>
                          <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wider text-muted font-medium whitespace-nowrap">{data && data.items.some((i) => i.calcMode === "rental") ? "Zisk / Čistý výnos" : "Odhadovaný zisk"}</th>
                          <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wider text-muted font-medium whitespace-nowrap">ROI / Výnos</th>
                          <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wider text-muted font-medium whitespace-nowrap">Status</th>
                          <th className="text-right p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {data.items.map((item, i) => (
                          <Fragment key={item.id}>
                            <motion.tr
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.25 }}
                            className="hover:bg-card-hover transition-colors"
                          >
                            <td className="p-3 pr-4 min-w-[200px]">
                              <button
                                type="button"
                                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                className="text-left w-full group"
                              >
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold capitalize truncate group-hover:text-accent transition-colors">
                                    {[item.city, item.district].filter(Boolean).join(" · ") || "Neznámá lokalita"}
                                  </p>
                                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${item.calcMode === "rental" ? "border-info/40 bg-info-soft text-info" : "border-accent/40 bg-accent-soft text-accent"}`}>
                                    {item.calcMode === "rental" ? "Nájem" : "Flip"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted whitespace-nowrap">
                                  <MapPin size={10} weight="bold" className="shrink-0" />
                                  <span className="truncate">{item.condition}</span>
                                  {item.area ? <span className="font-mono tabular-nums">{item.area} m²</span> : null}
                                  {item.rooms ? <span>{item.rooms}</span> : null}
                                  {item.floor !== null ? <span>{item.floor}. podlaží</span> : null}
                                </div>
                              </button>
                            </td>
                            <td className="p-3 text-right font-mono text-muted tabular-nums whitespace-nowrap">
                              {fmtPrice(item.originalPrice)}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <span className="font-mono font-semibold tabular-nums">{fmtPrice(item.offerPrice)}</span>
                              {item.savingsPct !== null && item.savingsPct > 0 && (
                                <span className="text-emerald-400 text-[11px] font-mono tabular-nums ml-1">−{item.savingsPct.toFixed(1)} %</span>
                              )}
                              {item.overBudget && (
                                <Badge variant="warning" size="sm" className="ml-1.5 gap-1">
                                  <WarningCircle size={10} weight="bold" />
                                  nad budget
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums whitespace-nowrap">
                              {item.calcMode === "rental" ? (
                                item.deal.type === "rental" && item.deal.netYield != null ? (
                                  <span className="text-emerald-400">{item.deal.netYield.toFixed(1)} %</span>
                                ) : (
                                  "—"
                                )
                              ) : (
                                item.deal.type === "flip" && item.deal.netProfit !== null ? (
                                  <span className={item.deal.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                                    {formatCompactPrice(item.deal.netProfit)}
                                  </span>
                                ) : (
                                  "—"
                                )
                              )}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums whitespace-nowrap">
                              {item.calcMode === "rental" ? (
                                "—"
                              ) : item.deal.type === "flip" && item.deal.roi !== null ? (
                                <span className={item.deal.roi >= 15 ? "text-emerald-400" : item.deal.roi >= 10 ? "text-amber-400" : "text-red-400"}>
                                  {formatPercent(item.deal.roi)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <StatusPill item={item} />
                            </td>
                            <td className="p-3 text-right">
                              <ActionButton item={item} busy={actionId === item.id} onClick={() => toggleReserve(item)} onWaitlist={() => toggleWaitlist(item)} />
                            </td>
                          </motion.tr>
                          {expandedId === item.id && (
                            <motion.tr
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="bg-card-hover/40"
                            >
                              <td colSpan={7} className="p-4">
                                <DealDetail item={item} />
                              </td>
                            </motion.tr>
                          )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden space-y-3">
                    {data.items.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.25 }}
                        className="rounded-2xl border border-border/50 bg-card p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight truncate">
                              {[item.city, item.district].filter(Boolean).join(" · ") || "Neznámá lokalita"}
                            </p>
                            <p className="text-xs text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="capitalize">{item.condition}</span>
                              {item.area && <span className="font-mono tabular-nums">{item.area} m²</span>}
                              {item.rooms && <span>{item.rooms}</span>}
                            </p>
                          </div>
                          <StatusPill item={item} />
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                          <Metric label="Inzerovaná cena" value={fmtPrice(item.originalPrice)} muted />
                          <Metric label="Cena po vyjednání" value={fmtPrice(item.offerPrice)} strong>
                            {item.overBudget && (
                              <Badge variant="warning" size="sm" className="ml-1.5 gap-1">
                                <WarningCircle size={10} weight="bold" />
                                nad budget
                              </Badge>
                            )}
                          </Metric>
                          <Metric
                            label="Sleva oproti inzerci"
                            value={
                              item.savingsPct !== null && item.savingsPct > 0
                                ? `−${item.savingsPct.toFixed(1)} %`
                                : "—"
                            }
                            accent={item.savingsPct !== null && item.savingsPct > 0}
                          />
                          {item.calcMode === "rental" ? (
                            <>
                              <Metric
                                label="Čistý výnos p.a."
                                value={item.deal.type === "rental" && item.deal.netYield != null ? `${item.deal.netYield.toFixed(1)} %` : "—"}
                                accent={item.deal.type === "rental" && item.deal.netYield != null}
                              />
                              <Metric
                                label="Cash-flow / měsíc"
                                value={item.deal.type === "rental" && item.deal.cashFlowMonthly != null ? formatCompactPrice(item.deal.cashFlowMonthly) : "—"}
                                accent={item.deal.type === "rental" && item.deal.cashFlowMonthly != null && item.deal.cashFlowMonthly >= 0}
                              />
                            </>
                          ) : (
                            <>
                              <Metric
                                label="Odhadovaný zisk"
                                value={item.deal.type === "flip" && item.deal.netProfit !== null ? formatCompactPrice(item.deal.netProfit) : "—"}
                                accent={item.deal.type === "flip" && item.deal.netProfit !== null && item.deal.netProfit >= 0}
                              />
                              <Metric
                                label="ROI (celkem)"
                                value={item.deal.type === "flip" && item.deal.roi != null ? `${item.deal.roi.toFixed(1)} %` : "—"}
                                accent={item.deal.type === "flip" && item.deal.roi != null && item.deal.roi >= 0}
                              />
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="w-full text-xs text-muted flex items-center justify-center gap-1 rounded-lg border border-border/40 bg-card-hover/40 py-2 hover:text-foreground hover:border-accent/30 transition-colors"
                        >
                          {expandedId === item.id ? "Skrýt detail výpočtu" : "Zobrazit detail výpočtu"}
                        </button>
                        {expandedId === item.id && <DealDetail item={item} />}

                        <div className="flex justify-end">
                          <ActionButton size="sm" item={item} busy={actionId === item.id} onClick={() => toggleReserve(item)} onWaitlist={() => toggleWaitlist(item)} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}

              <p className="text-xs text-muted flex items-start gap-1.5">
                <WarningCircle size={13} weight="bold" className="shrink-0 mt-0.5" />
                Rezervace zajišťuje přednostní přístup k nabídce a je nezávazná až do podpisu kupní smlouvy.
              </p>
            </>
          ) : (
            <div className="text-center py-24 text-muted text-sm">{error}</div>
          )}
        </main>
      </div>

      <EmailModal
        open={emailModalOpen}
        investorName={data?.investorName}
        onClose={() => {
          dismissedEmailPrompt.current = true;
          setEmailModalOpen(false);
        }}
        onSaved={(email) => {
          dismissedEmailPrompt.current = true;
          setEmailModalOpen(false);
          setData((prev) => (prev ? { ...prev, investorEmail: email } : prev));
        }}
      />
    </div>
  );
}

function DealDetail({ item }: { item: InvestorPortalItem }) {
  if (item.calcMode === "rental") {
    const deal = item.deal.type === "rental" ? item.deal : null;
    const snap = item.snapshot?.mode === "rental" ? item.snapshot : null;
    const hasItemized = snap && (snap.legalFee != null || snap.appraisalFee != null || snap.sourcingFee != null || snap.renovationCost != null || snap.noiAnnual != null || snap.cashOnCash != null);
    if (hasItemized) {
      return (
        <div className="rounded-xl border border-accent/20 bg-card-subtle/60 p-5 text-[13px] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Výnosová analýza</p>
            <Badge variant="secondary" size="sm">výpočet z kalkulačky</Badge>
          </div>
          <div className="space-y-2 text-[12px]">
            <DetailRow label="Kupní cena" value={snap.targetPurchasePrice != null ? formatCompactPrice(snap.targetPurchasePrice) : "—"} />
            {snap.legalFee != null && snap.legalFee > 0 && <DetailRow label="Právní služby" value={formatCompactPrice(snap.legalFee)} />}
            {snap.appraisalFee != null && snap.appraisalFee > 0 && <DetailRow label="Znalecký posudek" value={formatCompactPrice(snap.appraisalFee)} />}
            {snap.sourcingFee != null && snap.sourcingFee > 0 && <DetailRow label="Sourcing fee" value={formatCompactPrice(snap.sourcingFee)} />}
            {snap.renovationCost != null && snap.renovationCost > 0 && <DetailRow label="Rekonstrukce" value={formatCompactPrice(snap.renovationCost)} />}
            {snap.totalInvested != null && <DetailRow label="Celková investice" value={formatCompactPrice(snap.totalInvested)} accent />}
            {snap.noiAnnual != null && <DetailRow label="NOI ročně" value={formatCompactPrice(snap.noiAnnual)} />}
            <DetailRow label="Čistý výnos (p.a.)" value={deal?.netYield != null ? `${deal.netYield.toFixed(1)} %` : "—"} accent={deal?.netYield != null && deal.netYield >= 0} />
            <DetailRow label="Cash-flow / měsíc" value={deal?.cashFlowMonthly != null ? formatCompactPrice(deal.cashFlowMonthly) : "—"} accent={deal?.cashFlowMonthly != null && deal.cashFlowMonthly >= 0} />
            {snap.cashOnCash != null && <DetailRow label="Cash-on-cash" value={`${snap.cashOnCash.toFixed(1)} %`} accent={snap.cashOnCash >= 0} />}
          </div>
          <p className="text-[11px] text-muted pt-2 border-t border-border/20">Čísla odpovídají analýze z kalkulačky RealFlip uložené pro tuto nemovitost.</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-accent/20 bg-card-subtle/60 p-5 text-[13px] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Výnosová analýza</p>
          <Badge variant="secondary" size="sm">výpočet z kalkulačky</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
          <DetailRow label="Čistý výnos (p.a.)" value={deal?.netYield != null ? `${deal.netYield.toFixed(1)} %` : "—"} accent />
          <DetailRow label="Hrubý výnos" value={deal?.grossYield != null ? `${deal.grossYield.toFixed(1)} %` : "—"} />
          <DetailRow label="Výnos po dani" value={deal?.netYieldAfterTax != null ? `${deal.netYieldAfterTax.toFixed(1)} %` : "—"} />
          <DetailRow label="Cash-flow / měsíc" value={deal?.cashFlowMonthly != null ? formatCompactPrice(deal.cashFlowMonthly) : "—"} accent={deal?.cashFlowMonthly != null && deal.cashFlowMonthly >= 0} />
          <DetailRow label="Měsíční nájem" value={snap?.monthlyRent != null ? formatCompactPrice(snap.monthlyRent) : "—"} />
          <DetailRow label="Investice celkem" value={snap?.totalInvested != null ? formatCompactPrice(snap.totalInvested) : "—"} />
        </div>
        <p className="text-[11px] text-muted pt-2 border-t border-border/20">Čísla odpovídají analýze z kalkulačky RealFlip uložené pro tuto nemovitost.</p>
      </div>
    );
  }

  const deal = item.deal.type === "flip" ? item.deal : null;
  const snap = item.snapshot?.mode === "flip" ? item.snapshot : null;
  const hasItemized = snap && (snap.legalFees != null || snap.appraisalFee != null || snap.contingency != null || snap.holdingCosts != null || snap.sellingCommission != null || snap.marketingPhoto != null || snap.mortgageCost != null || snap.sourcingFee != null || snap.incomeTax != null);
  if (hasItemized) {
    const targetPrice = snap.targetPurchasePrice ?? snap.purchasePriceUsed;
    return (
      <div className="rounded-xl border border-accent/20 bg-card-subtle/60 p-5 text-[13px] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Odhadovaný zisk a ROI</p>
          <Badge variant="secondary" size="sm">výpočet z kalkulačky</Badge>
        </div>
        <div className="space-y-2 text-[12px]">
          <div className="text-[10px] font-semibold text-emerald-400 mb-1">Výpočet při cílové ceně {targetPrice != null ? formatCompactPrice(targetPrice) : "—"}</div>
          <DetailRow label="Kupní cena" value={targetPrice != null ? formatCompactPrice(targetPrice) : "—"} />
          {snap.legalFees != null && snap.legalFees > 0 && <DetailRow label="Právní služby" value={formatCompactPrice(snap.legalFees)} />}
          {snap.appraisalFee != null && snap.appraisalFee > 0 && <DetailRow label="Znalecký posudek" value={formatCompactPrice(snap.appraisalFee)} />}
          {snap.renovationCost != null && snap.renovationCost > 0 && <DetailRow label="Rekonstrukce" value={formatCompactPrice(snap.renovationCost)} />}
          {snap.contingency != null && snap.contingency > 0 && <DetailRow label="Rezerva 10 %" value={formatCompactPrice(snap.contingency)} />}
          {snap.sellingCommission != null && snap.sellingCommission > 0 && <DetailRow label="Provize RK prodejní (5 %)" value={formatCompactPrice(snap.sellingCommission)} />}
          {snap.marketingPhoto != null && snap.marketingPhoto > 0 && <DetailRow label="Marketing + foto" value={formatCompactPrice(snap.marketingPhoto)} />}
          {snap.holdingCosts != null && snap.holdingCosts > 0 && <DetailRow label={`Provozní náklady (${snap.holdingMonths ?? 6} měsíců)`} value={formatCompactPrice(snap.holdingCosts)} />}
          {snap.mortgageCost != null && snap.mortgageCost > 0 && <DetailRow label="Úrok z hypotéky" value={formatCompactPrice(snap.mortgageCost)} />}
          {snap.sourcingFee != null && snap.sourcingFee > 0 && <DetailRow label="Sourcing fee" value={formatCompactPrice(snap.sourcingFee)} />}
          {snap.incomeTax != null && snap.incomeTax > 0 && <DetailRow label="Daň z příjmu (21 %)" value={formatCompactPrice(snap.incomeTax)} />}
          {snap.totalCost != null && <DetailRow label="Náklady celkem" value={formatCompactPrice(snap.totalCost)} accent />}
          {deal?.arv != null && <DetailRow label="ARV (po rekonstrukci)" value={formatCompactPrice(deal.arv)} />}
          <DetailRow label="Odhadovaný zisk" value={deal?.netProfit != null ? formatCompactPrice(deal.netProfit) : "—"} accent={deal?.netProfit != null && deal.netProfit >= 0} />
          <DetailRow label="ROI (celkem)" value={deal?.roi != null ? `${deal.roi.toFixed(1)} %` : "—"} accent={deal?.roi != null && deal.roi >= 0} />
        </div>
        <p className="text-[11px] text-muted pt-2 border-t border-border/20">Čísla odpovídají analýze z kalkulačky RealFlip uložené pro tuto nemovitost.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-accent/20 bg-card-subtle/60 p-5 text-[13px] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Odhadovaný zisk a ROI</p>
        <Badge variant="secondary" size="sm">výpočet z kalkulačky</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
        <DetailRow label="ARV (po rekonstrukci)" value={deal?.arv != null ? formatCompactPrice(deal.arv) : "—"} />
        <DetailRow label="Kupní cena (v kalkulačce)" value={snap?.purchasePriceUsed != null ? formatCompactPrice(snap.purchasePriceUsed) : "—"} />
        <DetailRow label="Rekonstrukce" value={snap?.renovationCost != null ? formatCompactPrice(snap.renovationCost) : "—"} />
        <DetailRow label="Odhadovaný zisk" value={deal?.netProfit != null ? formatCompactPrice(deal.netProfit) : "—"} accent={deal?.netProfit != null && deal.netProfit >= 0} />
        <DetailRow label="ROI (celkem)" value={deal?.roi != null ? `${deal.roi.toFixed(1)} %` : "—"} accent={deal?.roi != null && deal.roi >= 0} />
      </div>
      {snap?.totalCost != null && (
        <div className="rounded-lg border border-border/30 bg-card/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">Náklady celkem (kupní + rekonstrukce + poplatky + daň)</span>
            <span className="font-mono tabular-nums font-semibold text-foreground">{formatCompactPrice(snap.totalCost)}</span>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted pt-2 border-t border-border/20">
        Čísla odpovídají analýze z kalkulačky RealFlip uložené pro tuto nemovitost.
      </p>
    </div>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`font-mono tabular-nums text-right whitespace-nowrap ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-hover ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted leading-none">{label}</p>
        <p className={`text-lg font-semibold font-mono leading-tight mt-1 ${tone}`}>{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ item }: { item: InvestorPortalItem }) {
  if (item.status === "reserved") {
    return (
      <Badge variant={item.reservedByMe ? "success" : "warning"} size="sm" className="gap-1">
        <CheckCircle size={11} weight="bold" />
        {item.reservedByMe ? "Moje rezervace" : "Rezervováno"}
      </Badge>
    );
  }
  if (item.waitlisted) {
    return (
      <Badge variant="info" size="sm" className="gap-1">
        <Hourglass size={11} weight="bold" />
        Na pořadníku
      </Badge>
    );
  }
  return <Badge variant="secondary" size="sm">Dostupná</Badge>;
}

function ActionButton({
  item,
  busy,
  onClick,
  onWaitlist,
  size = "md",
}: {
  item: InvestorPortalItem;
  busy: boolean;
  onClick: () => void;
  onWaitlist?: () => void;
  size?: "sm" | "md";
}) {
  const isMine = item.status === "reserved" && item.reservedByMe;
  if (item.status === "reserved" && !item.reservedByMe) {
    return (
      <div className="text-right">
        <span className="text-xs text-muted block whitespace-nowrap">
          {item.reservedByName ? `od ${item.reservedByName}` : "jiný investor"}
        </span>
        <button
          type="button"
          onClick={onWaitlist}
          disabled={busy}
          className="mt-1 text-[11px] font-medium text-accent hover:text-accent/80 hover:underline disabled:opacity-50 transition-colors"
        >
          {item.waitlisted ? "Odebrat z pořadníku" : "Přidat do pořadníku"}
        </button>
      </div>
    );
  }
  const countdown = isMine && item.reservationExpiresAt ? reservationCountdown(item.reservationExpiresAt) : null;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant={isMine ? "secondary" : "default"} size={size} loading={busy} onClick={onClick}>
        {isMine ? (
          <>
            <ArrowCounterClockwise size={14} weight="bold" />
            Uvolnit
          </>
        ) : (
          <>
            <SealCheck size={14} weight="bold" />
            Rezervovat
          </>
        )}
      </Button>
      {countdown && <span className="text-[10px] text-muted tabular-nums">drží {countdown}</span>}
    </div>
  );
}

function reservationCountdown(expiresAt: number): string {
  const left = expiresAt - Date.now();
  if (left <= 0) return "vypršela";
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function Metric({
  label,
  value,
  muted,
  strong,
  accent,
  children,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`font-mono tabular-nums mt-0.5 truncate ${strong ? "font-semibold" : ""} ${
          accent ? "text-emerald-400" : muted ? "text-muted" : ""
        }`}
      >
        {value}
        {children}
      </p>
    </div>
  );
}