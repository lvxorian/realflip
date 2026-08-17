"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import { EmailModal } from "@/components/investor/email-modal";
import { BrickonLogo } from "@/components/investor/brickon-logo";
import { PropertyImage } from "@/components/ui/property-image";
import {
  SignOut,
  CheckCircle,
  CircleNotch,
  HandCoins,
  SealCheck,
  ArrowCounterClockwise,
  WarningCircle,
  EnvelopeSimple,
  CaretLeft,
  CaretRight,
  CaretDown,
  X,
  ArrowsClockwise,
  Coins,
  Handshake,
  HouseLine,
  LightbulbFilament,
} from "@phosphor-icons/react";
import type { InvestorPortalItem } from "@/lib/investor-portal";
import { recalcFlipAtPrice, type CalcSnapshotFlip, type CooperationView, type FlipDealView } from "@/lib/investor-portal-view";
import { COOPERATION_STRATEGIES, type CooperationStrategy } from "@/lib/cooperation-models";
import { INVESTOR_BRAND } from "@/lib/investor-brand";

interface PortalData {
  items: InvestorPortalItem[];
  investorName: string;
  investorBudget: number | null;
  investorBudgetUnlimited: number;
  investorEmail: string | null;
  notice?: { message: string } | null;
}

function ModeBadge({ item }: { item: InvestorPortalItem }) {
  return (
    <span
      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        item.calcMode === "rental" ? "border-info/40 bg-info-soft text-info" : "border-accent/40 bg-accent-soft text-accent"
      }`}
    >
      {item.calcMode === "rental" ? "Nájem" : "Flip"}
    </span>
  );
}

/** Přepočet ceny na m²: „73 820 Kč/m²" (null, když chybí cena nebo plocha). */
function perSqmLabel(price: number | null | undefined, area: number | null | undefined): string | null {
  if (price == null || area == null || area <= 0) return null;
  return `${Math.round(price / area).toLocaleString("cs-CZ")} Kč/m²`;
}

/** Hodnoty nemovitosti na jednom řádku oddělené tečkou: 3+1 · 73 m² · Stav: Průměrný · Cihlový · 3. podlaží */
function PropertyMeta({ item }: { item: InvestorPortalItem }) {
  const parts: React.ReactNode[] = [];
  if (item.rooms) parts.push(<span key="rooms">{item.rooms}</span>);
  if (item.area) parts.push(<span key="area" className="font-mono tabular-nums">{item.area} m²</span>);
  if (item.condition) parts.push(<span key="condition">{`Stav: ${item.condition}`}</span>);
  if (item.buildingType && item.buildingType !== "—") parts.push(<span key="building">{item.buildingType}</span>);
  if (item.floor !== null && item.floor !== undefined) parts.push(<span key="floor">{item.floor}. podlaží</span>);
  if (parts.length === 0) return null;
  return (
    <>
      {parts.reduce<React.ReactNode[]>((acc, part, i) => {
        if (i > 0) acc.push(<span key={`sep-${i}`} className="text-muted/40 select-none">·</span>);
        acc.push(part);
        return acc;
      }, [])}
    </>
  );
}

/** Dostupné strategie spolupráce u flip itemu (prázdné u rental / bez cooperation). */
function availableStrategiesOf(item: InvestorPortalItem): CooperationStrategy[] {
  if (item.calcMode !== "flip" || !item.cooperation) return [];
  return item.cooperation.availableStrategies;
}

/** Čísla modelu spolupráce (zisk investora / ROI / investice) z cooperation bloku. */
function modelProfitOf(strategy: CooperationStrategy, coop: CooperationView): number | null {
  return strategy === "fifty-fifty" ? coop.investorProfitFiftyFifty : coop.investorProfitSourcing;
}

function modelRoiOf(strategy: CooperationStrategy, coop: CooperationView): number | null {
  return strategy === "fifty-fifty" ? coop.investorRoiFiftyFifty : coop.investorRoiSourcing;
}

function modelFundingOf(strategy: CooperationStrategy, coop: CooperationView): number | null {
  return strategy === "fifty-fifty" ? coop.fundingFiftyFifty : coop.fundingSourcing;
}

/** Krátký popis modelu pro detail i rezervační dialog. */
function modelDesc(strategy: CooperationStrategy, coop: CooperationView): string {
  return strategy === "fifty-fifty"
    ? "My zajišťujeme rekonstrukci, vy financujete. Zisk se dělí napůl."
    : `Kupujete a realizujete sami — platíte nám sourcing fee${coop.sourcingFee != null && coop.sourcingFee > 0 ? ` ${formatPrice(coop.sourcingFee)}` : ""}.`;
}

/** Karta legendy pro investora: typ investice (flip/rent). */
function LegendTypeCard({
  icon,
  title,
  points,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  points: string[];
  tone?: "accent" | "info";
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            tone === "info" ? "bg-info-soft text-info" : "bg-accent/15 text-accent"
          }`}
        >
          {icon}
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider">{title}</p>
      </div>
      <ul className="space-y-1">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted leading-snug">
            <CheckCircle size={12} weight="bold" className={`mt-0.5 shrink-0 ${tone === "info" ? "text-info/70" : "text-emerald-400"}`} />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Karta s modely spolupráce — kde se který model používá. */
function LegendModelsCard({
  models,
}: {
  models: { icon: React.ReactNode; title: string; desc: string }[];
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Handshake size={14} weight="bold" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider">Modely spolupráce</p>
      </div>
      {models.map((m) => (
        <div key={m.title} className="rounded-lg border border-border/40 bg-card-subtle/60 p-2.5 space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="shrink-0 text-accent">{m.icon}</span>
            {m.title}
          </p>
          <p className="text-[11px] text-muted leading-snug">{m.desc}</p>
        </div>
      ))}
    </div>
  );
}

export default function InvestorPortalPage() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<{ id: string; strategy: CooperationStrategy } | null>(null);
  const [reserveItem, setReserveItem] = useState<InvestorPortalItem | null>(null);
  const [reserveStrategy, setReserveStrategy] = useState<CooperationStrategy | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
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

  /** Kliknutí na Rezervovat: při obou dostupných modelech musí investor nejdřív vybrat.
   *  Jediný dostupný model (např. vypnutá parta = jen sourcing fee) rezervuje rovnou. */
  function handleReserveClick(item: InvestorPortalItem) {
    const strategies = availableStrategiesOf(item);
    if (strategies.length > 1) {
      setReserveItem(item);
      setReserveStrategy(null);
      setError("");
      return;
    }
    void performReserve(item, strategies.length === 1 ? strategies[0] : null);
  }

  async function performReserve(item: InvestorPortalItem, strategy: CooperationStrategy | null) {
    const action = item.status === "reserved" && item.reservedByMe ? "cancel" : "reserve";
    setActionId(item.id);
    setError("");
    try {
      const res = await fetch("/api/investor-portal/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action, strategy }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Operace se nepodařila.");
        setReserveItem(null);
        return;
      }
      setReserveItem(null);
      await refresh();
    } finally {
      setActionId(null);
    }
  }

  function confirmReserve() {
    if (!reserveItem || !reserveStrategy) return;
    void performReserve(reserveItem, reserveStrategy);
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
                    ? ` · budget ${formatPrice(data.investorBudget)}`
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

              {/* Legenda pro investora — skládací, ve výchozím stavu sbalená (šetří místo) */}
              <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setLegendOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-card-subtle/60"
                >
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                    <LightbulbFilament size={14} weight="bold" className="text-accent shrink-0" />
                    Jak to funguje — typy investic a modely spolupráce
                  </span>
                  <CaretDown size={14} weight="bold" className={`shrink-0 text-muted transition-transform ${legendOpen ? "rotate-180" : ""}`} />
                </button>
                {legendOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pb-4">
                    <LegendTypeCard
                      icon={<ArrowsClockwise size={14} weight="bold" />}
                      title="Flip"
                      points={[
                        "Koupíme, zrekonstruujeme a prodáme",
                        "Zisk z prodeje po rekonstrukci",
                        "Horizont: měsíce",
                      ]}
                    />
                    <LegendTypeCard
                      icon={<HouseLine size={14} weight="bold" />}
                      title="Nájem"
                      tone="info"
                      points={[
                        "Koupíme a držíme nemovitost",
                        "Pravidelný příjem z nájmu",
                        "Horizont: roky",
                      ]}
                    />
                    <LegendModelsCard
                      models={[
                        {
                          icon: <Handshake size={13} weight="bold" />,
                          title: "50/50",
                          desc: "My zajistíme rekonstrukci, vy financujete nákup — zisk napůl. Jen u flipu.",
                        },
                        {
                          icon: <Coins size={13} weight="bold" />,
                          title: "Sourcing fee",
                          desc: "Kupujete a realizujete sami, platíte poplatek za sourcing. U flipu i nájmu.",
                        },
                      ]}
                    />
                  </div>
                )}
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

              {data.notice && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-300"
                >
                  <WarningCircle size={15} weight="bold" className="shrink-0 mt-0.5" />
                  <span>{data.notice.message}</span>
                </motion.div>
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
                  {/* Karty nabídek — desktop i mobil */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.items.map((item, i) => {
                      const expanded = expandedId === item.id;
                      const coop = item.cooperation;
                      const isMine = item.status === "reserved" && item.reservedByMe;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.25 }}
                          className={cn(
                            "rounded-2xl border bg-card overflow-hidden transition-colors",
                            isMine ? "border-accent/60" : "border-border/50"
                          )}
                        >
                          {/* Foto + galerie */}
                          <PhotoGallery
                            photos={item.photos}
                            alt={[item.city, item.district].filter(Boolean).join(" · ") || "Nemovitost"}
                          >
                            <div className="absolute top-2 left-2">
                              <ModeBadge item={item} />
                            </div>
                            <div className="absolute top-2 right-2">
                              <StatusPill item={item} />
                            </div>
                          </PhotoGallery>

                          <div className="p-4 space-y-3">
                            {/* Lokalita + parametry */}
                            <div>
                              <p className="font-semibold leading-tight min-w-0 truncate">
                                {[item.city, item.district].filter(Boolean).join(" · ") || "Neznámá lokalita"}
                              </p>
                              <p className="text-xs text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                                <PropertyMeta item={item} />
                              </p>
                            </div>

                            {/* Ceny */}
                            <div className="rounded-xl border border-border/40 bg-card-subtle/60 px-3.5 py-3 space-y-1.5">
                              <PriceRow label="Inzerovaná cena" price={item.originalPrice} area={item.area} />
                              <PriceRow label="Cena po vyjednání" price={item.offerPrice} area={item.area} big />
                              {item.savingsPct !== null && item.savingsPct > 0 && (
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[11px] text-muted">Úspora oproti inzerci</span>
                                  <span className="text-xs font-mono text-emerald-400 tabular-nums font-semibold">
                                    −{item.savingsPct.toFixed(1)} %
                                  </span>
                                </div>
                              )}
                              {item.overBudget && (
                                <Badge variant="warning" size="sm" className="gap-1">
                                  <WarningCircle size={10} weight="bold" />
                                  nad budget
                                </Badge>
                              )}
                            </div>

                            {/* Klíčové metriky */}
                            {item.calcMode === "rental" ? (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                <Metric
                                  label="Čistý výnos (p.a.)"
                                  value={item.deal.type === "rental" && item.deal.netYield != null ? `${item.deal.netYield.toFixed(1)} %` : "—"}
                                  accent={item.deal.type === "rental" && item.deal.netYield != null}
                                />
                                <Metric
                                  label="Cash-flow / měsíc"
                                  value={item.deal.type === "rental" && item.deal.cashFlowMonthly != null ? formatPrice(item.deal.cashFlowMonthly) : "—"}
                                  accent={item.deal.type === "rental" && item.deal.cashFlowMonthly != null && item.deal.cashFlowMonthly >= 0}
                                />
                                <Metric
                                  label="Měsíční nájem"
                                  value={item.snapshot?.mode === "rental" && item.snapshot.monthlyRent != null ? formatPrice(item.snapshot.monthlyRent) : "—"}
                                />
                                <Metric
                                  label="Investice celkem"
                                  value={item.snapshot?.mode === "rental" && item.snapshot.totalInvested != null ? formatPrice(item.snapshot.totalInvested) : "—"}
                                />
                              </div>
                            ) : coop && coop.availableStrategies.length > 0 ? (
                              <div className={`grid gap-2 ${coop.availableStrategies.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                                {coop.availableStrategies.map((s) => {
                                  const open = expandedModel?.id === item.id && expandedModel.strategy === s;
                                  return (
                                    <ModelProfitCard
                                      key={s}
                                      strategy={s}
                                      coop={coop}
                                      active={open}
                                      onClick={() => setExpandedModel(open ? null : { id: item.id, strategy: s })}
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                <Metric
                                  label="Odhadovaný zisk"
                                  value={item.deal.type === "flip" && item.deal.netProfit != null ? formatPrice(item.deal.netProfit) : "—"}
                                  accent={item.deal.type === "flip" && item.deal.netProfit != null && item.deal.netProfit >= 0}
                                />
                                <Metric
                                  label="ROI projektu"
                                  value={item.deal.type === "flip" && item.deal.roi != null ? `${item.deal.roi.toFixed(1)} %` : "—"}
                                  accent={item.deal.type === "flip" && item.deal.roi != null && item.deal.roi >= 0}
                                />
                                <Metric
                                  label="ARV po rekonstrukci"
                                  value={item.deal.type === "flip" && item.deal.arv != null ? formatPrice(item.deal.arv) : "—"}
                                />
                              </div>
                            )}

                            {/* Detail výpočtu */}
                            {item.calcMode !== "rental" && coop && coop.availableStrategies.length > 0 ? (
                              expandedModel?.id === item.id && (
                                <ModelDetail item={item} strategy={expandedModel.strategy} />
                              )
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(expanded ? null : item.id)}
                                  className="w-full text-xs text-muted flex items-center justify-center gap-1 rounded-lg border border-border/40 bg-card-hover/40 py-2 hover:text-foreground hover:border-accent/30 transition-colors"
                                >
                                  {expanded ? "Skrýt detail výpočtu" : "Zobrazit detail výpočtu"}
                                </button>
                                {expanded && (
                                  <DealDetail item={item} />
                                )}
                              </>
                            )}

                            {/* Rezervace */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                {isMine && item.reservationExpiresAt ? (
                                  <span className="text-xs text-muted tabular-nums">{reservationCountdown(item.reservationExpiresAt)}</span>
                                ) : item.status === "reserved" && !item.reservedByMe ? (
                                  <span className="text-xs text-muted">
                                    {item.reservedByName ? `Rezervováno od ${item.reservedByName}` : "Rezervováno jiným investorem"}
                                  </span>
                                ) : (
                                  <span className="text-xs text-emerald-400">Dostupná k rezervaci</span>
                                )}
                              </div>
                              <ActionButton item={item} busy={actionId === item.id} size="sm" onClick={() => handleReserveClick(item)} />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
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

      <ReserveModal
        open={reserveItem != null}
        item={reserveItem}
        strategy={reserveStrategy}
        busy={actionId != null}
        onSelect={setReserveStrategy}
        onConfirm={confirmReserve}
        onClose={() => {
          setReserveItem(null);
          setReserveStrategy(null);
        }}
      />

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

/** Galerie fotek nemovitosti: hlavní fotka v pevném poměru 8:5 + šipky
 *  pro listování (stejný vzor jako karty nemovitostí v RealFlipu). */
function PhotoGallery({
  photos,
  alt,
  children,
}: {
  photos: string[];
  alt: string;
  children?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const safeIndex = photos.length > 0 ? Math.min(index, photos.length - 1) : 0;
  const current = photos.length > 0 ? photos[safeIndex] : null;
  const canCycle = photos.length > 1;
  const cyclePhoto = (dir: 1 | -1) => {
    if (photos.length < 2) return;
    setIndex((i) => (i + dir + photos.length) % photos.length);
  };

  return (
    <div className="relative aspect-[8/5] w-full">
      <PropertyImage key={current ?? "no-photo"} src={current} alt={alt} containerClassName="h-full w-full" />
      {canCycle && (
        <>
          <button
            type="button"
            onClick={() => cyclePhoto(-1)}
            aria-label="Předchozí foto"
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent z-10"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => cyclePhoto(1)}
            aria-label="Další foto"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent z-10"
          >
            <CaretRight size={14} weight="bold" />
          </button>
          <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
            {safeIndex + 1} / {photos.length}
          </div>
        </>
      )}
      {children}
    </div>
  );
}

function DealDetail({ item }: { item: InvestorPortalItem }) {
  if (item.calcMode === "rental") {
    const deal = item.deal.type === "rental" ? item.deal : null;
    const snap = item.snapshot?.mode === "rental" ? item.snapshot : null;
    return (
      <div className="rounded-xl border border-accent/20 bg-card-subtle/60 p-5 text-[13px] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Výnosová analýza</p>
          <Badge variant="secondary" size="sm">výpočet z kalkulačky</Badge>
        </div>
        <div className="space-y-2 text-[12px]">
          <DetailRow label="Kupní cena" value={snap?.targetPurchasePrice != null ? formatPrice(snap.targetPurchasePrice) : "—"} />
          {snap?.legalFee != null && snap.legalFee > 0 && <DetailRow label="Právní služby" value={formatPrice(snap.legalFee)} />}
          {snap?.appraisalFee != null && snap.appraisalFee > 0 && <DetailRow label="Znalecký posudek" value={formatPrice(snap.appraisalFee)} />}
          {snap?.sourcingFee != null && snap.sourcingFee > 0 && <DetailRow label="Sourcing fee" value={formatPrice(snap.sourcingFee)} />}
          {snap?.renovationCost != null && snap.renovationCost > 0 && <DetailRow label="Rekonstrukce" value={formatPrice(snap.renovationCost)} />}
          {snap?.totalInvested != null && <DetailRow label="Celková investice" value={formatPrice(snap.totalInvested)} accent />}
          {snap?.noiAnnual != null && <DetailRow label="NOI ročně" value={formatPrice(snap.noiAnnual)} />}
          <DetailRow label="Hrubý výnos" value={deal?.grossYield != null ? `${deal.grossYield.toFixed(1)} %` : "—"} />
          <DetailRow label="Čistý výnos (p.a.)" value={deal?.netYield != null ? `${deal.netYield.toFixed(1)} %` : "—"} accent={deal?.netYield != null && deal.netYield >= 0} />
          <DetailRow label="Výnos po dani" value={deal?.netYieldAfterTax != null ? `${deal.netYieldAfterTax.toFixed(1)} %` : "—"} />
          <DetailRow label="Cash-flow / měsíc" value={deal?.cashFlowMonthly != null ? formatPrice(deal.cashFlowMonthly) : "—"} accent={deal?.cashFlowMonthly != null && deal.cashFlowMonthly >= 0} />
          <DetailRow label="Měsíční nájem" value={snap?.monthlyRent != null ? formatPrice(snap.monthlyRent) : "—"} />
          {snap?.cashOnCash != null && <DetailRow label="Cash-on-cash" value={`${snap.cashOnCash.toFixed(1)} %`} accent={snap.cashOnCash >= 0} />}
        </div>
      </div>
    );
  }

  const deal = item.deal.type === "flip" ? item.deal : null;
  const snap = item.snapshot?.mode === "flip" ? item.snapshot : null;
  const kupniCena = item.offerPrice ?? snap?.targetPurchasePrice ?? snap?.purchasePriceUsed ?? null;
  return (
    <div className="rounded-xl border border-accent/20 bg-card-subtle/60 p-5 text-[13px] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Odhadovaný zisk a ROI</p>
        <Badge variant="secondary" size="sm">výpočet z kalkulačky</Badge>
      </div>
      <div className="space-y-2 text-[12px]">
        <div className="text-[10px] font-semibold text-emerald-400 mb-1">Výpočet při kupní ceně {kupniCena != null ? formatPrice(kupniCena) : "—"}</div>
        <FlipCostRows snap={snap} deal={deal} coop={item.cooperation} kupniCena={kupniCena} area={item.area} showProfit />
      </div>
    </div>
  );
}

/** Řádek ceny s menším přepočtem na m² pod hodnotou. */
function PriceRow({
  label,
  price,
  area,
  big,
}: {
  label: string;
  price: number | null;
  area: number | null;
  big?: boolean;
}) {
  const perSqm = perSqmLabel(price, area);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-muted leading-snug">{label}</span>
      <span className="text-right">
        <span
          className={`block font-mono tabular-nums whitespace-nowrap ${
            big ? "text-lg font-semibold text-amber-400" : "text-xs text-muted"
          }`}
        >
          {price != null ? formatPrice(price) : "—"}
        </span>
        {perSqm && (
          <span className="block text-[10px] font-mono text-muted/50 tabular-nums whitespace-nowrap">
            {perSqm}
          </span>
        )}
      </span>
    </div>
  );
}

/** Detail výpočtu konkrétního modelu spolupráce (rozbalený z karty modelu). */
function ModelDetail({ item, strategy }: { item: InvestorPortalItem; strategy: CooperationStrategy }) {
  const deal = item.deal.type === "flip" ? item.deal : null;
  const snap = item.snapshot?.mode === "flip" ? item.snapshot : null;
  const coop = item.cooperation;
  const kupniCena = item.offerPrice ?? snap?.targetPurchasePrice ?? snap?.purchasePriceUsed ?? null;
  if (!coop) return null;
  return (
    <div className="rounded-xl border border-accent/20 bg-card-subtle/60 p-5 text-[13px] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          Model {COOPERATION_STRATEGIES[strategy]} · detail výpočtu
        </p>
        <Badge variant="secondary" size="sm">výpočet z kalkulačky</Badge>
      </div>
      <div className="space-y-2 text-[12px]">
        <div className="text-[10px] font-semibold text-emerald-400 mb-1">Rozpočet při kupní ceně {kupniCena != null ? formatPrice(kupniCena) : "—"}</div>
        <FlipCostRows snap={snap} deal={deal} coop={coop} kupniCena={kupniCena} area={item.area} strategy={strategy} />
      </div>
      <ModelDetailBlock strategy={strategy} coop={coop} />
    </div>
  );
}

/** Společný rozpis nákladů flipu z uložené kalkulačky na cenové bázi, kterou
 *  investor vidí (Kupní cena = cena po vyjednání). Náklady celkem = investice
 *  investora u daného modelu: u 50/50 se sourcing fee neúčtuje (celkem bez
 *  fee), u sourcing fee je fee součástí nákladů a je vidět jako řádek. */
function FlipCostRows({
  snap,
  deal,
  coop,
  kupniCena,
  area,
  strategy,
  showProfit,
}: {
  snap: CalcSnapshotFlip | null;
  deal: FlipDealView | null;
  coop: CooperationView | null;
  kupniCena: number | null;
  area: number | null;
  strategy?: CooperationStrategy;
  showProfit?: boolean;
}) {
  const isFifty = strategy === "fifty-fifty";
  const sourcingFee = coop?.sourcingFee ?? snap?.sourcingFee ?? null;
  // Náklady celkem musí souznít s investicí investora u daného modelu
  // (hodnoty cooperation jsou už přepočtené na vyjednanou cenu).
  const totalCost = isFifty
    ? (coop?.fundingFiftyFifty ??
        (snap?.totalCost != null && sourcingFee != null ? snap.totalCost - sourcingFee : (snap?.totalCost ?? null)))
    : (coop?.fundingSourcing ?? snap?.totalCost);
  // Daň z příjmu závisí na kupní ceně — při odlišné ceně se přepočte přesně
  // (stejně jako v kalkulačce), jinak se použije hodnota ze snapshotu.
  const recalc = snap && kupniCena != null ? recalcFlipAtPrice(snap, kupniCena) : null;
  const incomeTax = recalc?.incomeTax ?? snap?.incomeTax ?? null;
  return (
    <>
      <DetailRow label="Kupní cena" value={kupniCena != null ? formatPrice(kupniCena) : "—"} />
      {snap?.legalFees != null && snap.legalFees > 0 && <DetailRow label="Právní služby" value={formatPrice(snap.legalFees)} />}
      {snap?.appraisalFee != null && snap.appraisalFee > 0 && <DetailRow label="Znalecký posudek" value={formatPrice(snap.appraisalFee)} />}
      {snap?.renovationCost != null && snap.renovationCost > 0 && (
        <DetailRow label="Rekonstrukce" value={formatPrice(snap.renovationCost)} sub={perSqmLabel(snap.renovationCost, area)} />
      )}
      {snap?.contingency != null && snap.contingency > 0 && <DetailRow label="Rezerva 10 %" value={formatPrice(snap.contingency)} />}
      {snap?.sellingCommission != null && snap.sellingCommission > 0 && <DetailRow label="Provize RK prodejní (5 %)" value={formatPrice(snap.sellingCommission)} />}
      {snap?.marketingPhoto != null && snap.marketingPhoto > 0 && <DetailRow label="Marketing + foto" value={formatPrice(snap.marketingPhoto)} />}
      {snap?.holdingCosts != null && snap.holdingCosts > 0 && <DetailRow label={`Provozní náklady (${snap.holdingMonths ?? 6} měsíců)`} value={formatPrice(snap.holdingCosts)} />}
      {snap?.mortgageCost != null && snap.mortgageCost > 0 && <DetailRow label="Úrok z hypotéky" value={formatPrice(snap.mortgageCost)} />}
      {!isFifty && sourcingFee != null && sourcingFee > 0 && <DetailRow label="Sourcing fee" value={formatPrice(sourcingFee)} />}
      {incomeTax != null && incomeTax > 0 && <DetailRow label="Daň z příjmu (21 %)" value={formatPrice(incomeTax)} />}
      {totalCost != null && <DetailRow label="Náklady celkem" value={formatPrice(totalCost)} accent />}
      <DetailRow
        label="ARV (po rekonstrukci)"
        value={deal?.arv != null ? formatPrice(deal.arv) : "—"}
        sub={perSqmLabel(deal?.arv ?? null, area)}
      />
      {showProfit && (
        <DetailRow
          label="Odhadovaný zisk"
          value={deal?.netProfit != null ? formatPrice(deal.netProfit) : "—"}
          accent={deal?.netProfit != null && deal.netProfit >= 0}
        />
      )}
      <DetailRow label="ROI projektu" value={deal?.roi != null ? `${deal.roi.toFixed(1)} %` : "—"} accent={deal?.roi != null && deal.roi >= 0} />
    </>
  );
}

function DetailRow({ label, value, accent, sub }: { label: string; value: string; accent?: boolean; sub?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-[11px] text-muted min-w-0">{label}</p>
      <div className="text-right">
        <p className={`font-mono tabular-nums break-words ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted/60 font-mono tabular-nums">{sub}</p>}
      </div>
    </div>
  );
}

/** Karta modelu spolupráce: název modelu + zisk investora. Klik = rozbalení detailu. */
function ModelProfitCard({
  strategy,
  coop,
  active,
  onClick,
}: {
  strategy: CooperationStrategy;
  coop: CooperationView;
  active: boolean;
  onClick: () => void;
}) {
  const profit = modelProfitOf(strategy, coop);
  const sub = strategy === "fifty-fifty" ? "váš zisk · polovina obchodu" : "váš zisk · po rekonstrukci";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${
        active ? "border-accent/50 bg-accent/10" : "border-border/40 bg-card-subtle/60 hover:border-accent/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Model {COOPERATION_STRATEGIES[strategy]}</p>
        <span className={`text-muted transition-transform ${active ? "rotate-180" : ""}`}>
          <CaretDown size={12} weight="bold" />
        </span>
      </div>
      <p className="text-[10px] text-muted mt-0.5">{sub}</p>
      <p className={`font-mono text-lg font-semibold tabular-nums mt-1 break-words ${profit != null && profit >= 0 ? "text-emerald-400" : "text-muted"}`}>
        {profit != null ? formatPrice(profit) : "—"}
      </p>
    </button>
  );
}

/** Rozpis jednoho modelu spolupráce v detailu výpočtu: investice, zisk, ROI. */
function ModelDetailBlock({ strategy, coop }: { strategy: CooperationStrategy; coop: CooperationView }) {
  const isFifty = strategy === "fifty-fifty";
  const funding = modelFundingOf(strategy, coop);
  const profit = modelProfitOf(strategy, coop);
  const roi = modelRoiOf(strategy, coop);
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-3.5 space-y-2">
      <DetailRow label="Vaše investice" value={funding != null ? formatPrice(funding) : "—"} />
      <DetailRow
        label={isFifty ? "Váš zisk (polovina obchodu)" : "Váš zisk (po rekonstrukci)"}
        value={profit != null ? formatPrice(profit) : "—"}
        accent={profit != null && profit >= 0}
      />
      <DetailRow
        label="ROI vaší investice"
        value={roi != null ? `${roi.toFixed(1)} %` : "—"}
        accent={roi != null && roi >= 0}
      />
    </div>
  );
}

/** Modal s výběrem modelu spolupráce před rezervací (když jsou dostupné oba modely). */
function ReserveModal({
  open,
  item,
  strategy,
  busy,
  onSelect,
  onConfirm,
  onClose,
}: {
  open: boolean;
  item: InvestorPortalItem | null;
  strategy: CooperationStrategy | null;
  busy: boolean;
  onSelect: (s: CooperationStrategy) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const coop = item?.cooperation;
  return (
    <AnimatePresence>
      {open && item && coop && (
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
                  <HandCoins size={20} weight="bold" className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold tracking-tight leading-tight">Vyberte způsob spolupráce</h2>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    {[item.city, item.district].filter(Boolean).join(" · ") || "Nabídka"} — jak chcete obchod realizovat?
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

              <div className="mt-5 space-y-2">
                {coop.availableStrategies.map((s) => {
                  const active = strategy === s;
                  const profit = modelProfitOf(s, coop);
                  const roi = modelRoiOf(s, coop);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSelect(s)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3.5 transition-colors",
                        active ? "border-accent/50 bg-accent/10" : "border-border/40 bg-card-hover/40 hover:border-accent/30"
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-sm font-semibold ${active ? "text-accent" : "text-foreground"}`}>
                          Model {COOPERATION_STRATEGIES[s]}
                        </span>
                        <span className={`font-mono text-sm font-semibold tabular-nums ${profit != null && profit >= 0 ? "text-emerald-400" : "text-muted"}`}>
                          {profit != null ? formatPrice(profit) : "—"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-1">{modelDesc(s, coop)}</p>
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/20 text-[11px]">
                        <span className="text-muted">ROI vaší investice</span>
                        <span className={`font-mono tabular-nums ${roi != null && roi >= 0 ? "text-emerald-400" : "text-foreground"}`}>
                          {roi != null ? `${roi.toFixed(1)} %` : "—"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-5">
                <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                  Zrušit
                </Button>
                <Button type="button" loading={busy} disabled={!strategy} onClick={onConfirm} className="flex-1 gap-1.5">
                  <SealCheck size={14} weight="bold" />
                  Potvrdit rezervaci
                </Button>
              </div>
              <p className="text-[11px] text-muted mt-3 leading-relaxed">
                Způsob spolupráce určí, jak se u obchodu rozdělí zisk a investice. Potvrzením si nabídku rezervujete.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
      {countdown && <span className="text-[10px] text-muted tabular-nums">{countdown}</span>}
    </div>
  );
}

function reservationCountdown(expiresAt: number): string {
  const left = expiresAt - Date.now();
  if (left <= 0) return "rezervace vypršela";
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return `vyprší za ${h}h ${m}m`;
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
        className={`font-mono tabular-nums mt-0.5 break-words ${strong ? "font-semibold" : ""} ${
          accent ? "text-emerald-400" : muted ? "text-muted" : ""
        }`}
      >
        {value}
        {children}
      </p>
    </div>
  );
}