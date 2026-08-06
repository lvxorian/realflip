"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
                  { icon: <CheckCircle size={14} weight="bold" />, text: "Kurátorský výběr nabídek" },
                  { icon: <CheckCircle size={14} weight="bold" />, text: "Vyjednaná cena pod trhem" },
                  { icon: <CheckCircle size={14} weight="bold" />, text: "Analytické prověření" },
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
                  <p className="text-xs text-muted mt-1">Nové příležitosti pod tržní cenou se objevují průběžně — vraťte se brzy.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden lg:block rounded-2xl border border-border/50 bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/30">
                            <th className="text-left p-4 text-xs text-muted font-medium">Makrolokalita</th>
                            <th className="text-left p-4 text-xs text-muted font-medium">Stav</th>
                            <th className="text-right p-4 text-xs text-muted font-medium">m²</th>
                            <th className="text-right p-4 text-xs text-muted font-medium">Tržní cena</th>
                            <th className="text-right p-4 text-xs text-muted font-medium">Kupní cena</th>
                            <th className="text-right p-4 text-xs text-muted font-medium">Sleva oproti trhu</th>
                            <th className="text-right p-4 text-xs text-muted font-medium">Odhadovaný zisk</th>
                            <th className="text-right p-4 text-xs text-muted font-medium">ROI</th>
                            <th className="text-right p-4 text-xs text-muted font-medium">Status</th>
                            <th className="text-right p-4 text-xs text-muted font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {data.items.map((item, i) => (
                            <motion.tr
                              key={item.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.25 }}
                              className="hover:bg-card-hover transition-colors"
                            >
                              <td className="p-4">
                                <p className="font-medium">
                                  {[item.city, item.district].filter(Boolean).join(" · ") || "Neznámá lokalita"}
                                </p>
                                <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                                  <MapPin size={11} weight="bold" />
                                  {[item.city, item.district].filter(Boolean).join(" · ") || "—"}
                                  {item.floor !== null ? ` · ${item.floor}. podlaží` : ""}
                                </p>
                              </td>
                              <td className="p-4">{item.condition}</td>
                              <td className="p-4 text-right font-mono">
                                {item.area ?? "—"}
                                {item.rooms ? <span className="text-xs text-muted"> ({item.rooms})</span> : null}
                              </td>
                              <td className="p-4 text-right font-mono text-muted">{fmtPrice(item.originalPrice)}</td>
                              <td className="p-4 text-right">
                                <span className="font-mono font-medium">{fmtPrice(item.offerPrice)}</span>
                                {item.overBudget && (
                                  <Badge variant="warning" size="sm" className="ml-2 gap-1">
                                    <WarningCircle size={10} weight="bold" />
                                    nad budget
                                  </Badge>
                                )}
                              </td>
                              <td className="p-4 text-right font-mono">
                                {item.savingsPct !== null && item.savingsPct > 0 ? (
                                  <span className="text-emerald-400">−{item.savingsPct.toFixed(1)} %</span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="p-4 text-right font-mono">
                                {item.netProfit !== null ? (
                                  <span className={item.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                                    {formatCompactPrice(item.netProfit)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-4 text-right font-mono">
                                {item.roi !== null ? formatPercent(item.roi) : "—"}
                              </td>
                              <td className="p-4 text-right">
                                <StatusPill item={item} />
                              </td>
                              <td className="p-4 text-right">
                                <ActionButton item={item} busy={actionId === item.id} onClick={() => toggleReserve(item)} />
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                          <div>
                            <p className="font-semibold leading-tight">
                              {[item.city, item.district].filter(Boolean).join(" · ") || "Neznámá lokalita"}
                            </p>
                            <p className="text-xs text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                              <Badge variant="secondary" size="sm">{item.condition}</Badge>
                              {item.area && <span className="font-mono">{item.area} m²</span>}
                              {item.rooms && <span>{item.rooms}</span>}
                            </p>
                          </div>
                          <StatusPill item={item} />
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <Metric label="Tržní cena" value={fmtPrice(item.originalPrice)} muted />
                          <Metric label="Kupní cena" value={fmtPrice(item.offerPrice)} strong>
                            {item.overBudget && (
                              <Badge variant="warning" size="sm" className="ml-1.5 gap-1">
                                <WarningCircle size={10} weight="bold" />
                                nad budget
                              </Badge>
                            )}
                          </Metric>
                          <Metric
                            label="Sleva oproti trhu"
                            value={
                              item.savingsPct !== null && item.savingsPct > 0
                                ? `−${item.savingsPct.toFixed(1)} %`
                                : "—"
                            }
                            accent={item.savingsPct !== null && item.savingsPct > 0}
                          />
                          <Metric
                            label="Odhadovaný zisk"
                            value={item.netProfit !== null ? formatCompactPrice(item.netProfit) : "—"}
                            accent={item.netProfit !== null && item.netProfit >= 0}
                          />
                        </div>

                        <div className="flex justify-end">
                          <ActionButton size="sm" item={item} busy={actionId === item.id} onClick={() => toggleReserve(item)} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}

              <p className="text-xs text-muted flex items-start gap-1.5">
                <WarningCircle size={13} weight="bold" className="shrink-0 mt-0.5" />
                Rezervace zakládá pořadí přístupu k nabídce a je nezávazná do uzavření a podpisu kupní smlouvy.
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
  return <Badge variant="secondary" size="sm">Dostupná</Badge>;
}

function ActionButton({
  item,
  busy,
  onClick,
  size = "md",
}: {
  item: InvestorPortalItem;
  busy: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const isMine = item.status === "reserved" && item.reservedByMe;
  if (item.status === "reserved" && !item.reservedByMe) {
    return (
      <span className="text-xs text-muted text-right block whitespace-nowrap">
        {item.reservedByName ? `od ${item.reservedByName}` : "jiný investor"}
      </span>
    );
  }
  return (
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
  );
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
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`font-mono mt-0.5 ${strong ? "font-semibold" : ""} ${
          accent ? "text-emerald-400" : muted ? "text-muted" : ""
        }`}
      >
        {value}
        {children}
      </p>
    </div>
  );
}