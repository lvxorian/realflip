"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { StatusDot } from "@/components/ui/status-dot";
import { PriceTag } from "@/components/ui/price-tag";
import { PropertyImage } from "@/components/ui/property-image";
import { conditionLabel, safeJsonParse, formatCompactPrice, formatRelative, parseDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, PhoneSlash, SkipForward, Copy, Check, MapPin, CalendarBlank, ChartLineUp, ArrowUpRight, Prohibit } from "@phosphor-icons/react";

interface CallItem {
  id: string;
  propertyId: string | null;
  stage: string;
  notes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  propertyTitle: string | null;
  propertyPrice: number | null;
  propertyPricePerSqm: number | null;
  propertyArea: number | null;
  propertyRooms: string | null;
  propertyAddress: string | null;
  propertyCondition: string | null;
  propertyDescription: string | null;
  propertyFloor: number | null;
  propertyYearBuilt: number | null;
  propertyImageUrls: string | null;
  propertyUrl: string | null;
  propertyPortal: string | null;
  propertyRemoved: boolean;
  propertyRemovedAt: number | null;
  analysisScore: number | null;
  analysisNetProfit: number | null;
  analysisRoi: number | null;
  analysisAnnualizedRoi: number | null;
  analysisCashOnCash: number | null;
  analysisArv: number | null;
  analysisRenovationCost: number | null;
  analysisTotalCost: number | null;
  analysisMarketValue: number | null;
  analysisUndervaluationPct: number | null;
  analysisOverpricingPct: number | null;
  analysisPricePerSqm: number | null;
  analysisMarketPriceMin: number | null;
  analysisMarketPriceMax: number | null;
  analysisBreakEvenPrice: number | null;
  analysisTargetPurchasePrice: number | null;
  analysisRentalYield: number | null;
  analysisVerdictLevel: string | null;
  analysisVerdictSummary: string | null;
  analysisRedFlagsJson: string | null;
  analysisMarketSource: string | null;
  analysisMarketSampleSize: number | null;
  analysisUpdatedAt: number | null;
}

interface MeetingLead {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  propertyTitle: string | null;
  propertyAddress: string | null;
  meeting: { date: string | null; location: string | null };
}

interface LeadWithMeeting {
  id: string;
  stage: string;
  contactName: string | null;
  contactPhone: string | null;
  propertyTitle: string | null;
  propertyAddress: string | null;
  stageData: {
    meeting?: { date: string | null; location?: string | null } | null;
  } | null;
}

const outcomes = [
  { label: "Nezvedá", stage: "contacted", from: ["new"], color: "border-red-500/30 text-red-400 hover:bg-red-500/10" },
  { label: "Volat znovu", stage: "contacted", from: ["new", "contacted"], color: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" },
  { label: "Nezájem", stage: "lost", from: ["new", "contacted", "negotiation", "offer"], color: "border-red-500/30 text-red-400 hover:bg-red-500/10" },
  { label: "Zájem", stage: "meeting", from: ["new", "contacted"], color: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" },
];

const scriptSteps = [
  "Dobrý den, jmenuji se [jméno] z RealFlip Investments.",
  "Viděl jsem Váš inzerát na [portálu] ohledně prodeje [adresa].",
  "Mám zájemce, kterého by tato nemovitost mohla zajímat. Mohl bych Vám nabídnout rychlý prodej bez provize?",
  "Kdy bychom se mohli domluvit na prohlídce?",
];

const smsTemplate = "Dobrý den, jsem investor z RealFlip a měl bych zájem o Vaši nemovitost. Mohl bych se přijít podívat? Děkuji. [jméno]";

const VERDICT_LABELS: Record<string, string> = {
  strongBuy: "Silně",
  buy: "Doporučeno",
  consider: "Zvážit",
  dontBuy: "Nekupovat",
  categoricalReject: "Odmítnout",
};

const VERDICT_COLORS: Record<string, string> = {
  strongBuy: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  buy: "text-green-400 border-green-500/20 bg-green-500/10",
  consider: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  dontBuy: "text-red-400 border-red-500/20 bg-red-500/10",
  categoricalReject: "text-red-400 border-red-500/20 bg-red-500/10",
};

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-2.5">
      <span className="text-[10px] text-muted block">{label}</span>
      <p className={`font-mono font-semibold text-xs mt-0.5 ${valueClass ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

export default function CallModePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [calling, setCalling] = useState(false);
  const [scriptStep, setScriptStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/call-mode")
      .then((r) => r.json())
      .then((d: CallItem[]) => {
        if (Array.isArray(d)) {
          setCalls(d);
          if (d[0]) setNotes(d[0].notes ?? "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/leads", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: LeadWithMeeting[]) => {
        if (!Array.isArray(d)) return;
        const upcoming: MeetingLead[] = [];
        for (const l of d) {
          const meeting = l.stageData?.meeting;
          const date = meeting?.date;
          const parsedDate = parseDate(date);
          if (l.stage === "meeting" && parsedDate) {
            upcoming.push({
              id: l.id,
              contactName: l.contactName ?? null,
              contactPhone: l.contactPhone ?? null,
              propertyTitle: l.propertyTitle ?? null,
              propertyAddress: l.propertyAddress ?? null,
              meeting: { date: parsedDate.toISOString(), location: meeting?.location ?? null },
            });
          }
        }
        upcoming.sort((a, b) => new Date(a.meeting.date!).getTime() - new Date(b.meeting.date!).getTime());
        setMeetings(upcoming);
      })
      .catch(() => {});
  }, [status]);

  if (status !== "authenticated" || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Call Mode</h1>
            <Skeleton className="h-4 w-24 mt-1" />
          </div>
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Call Mode</h1>
            <p className="text-sm text-muted mt-1">Žádné leady k volání</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
          <p className="text-sm text-muted">Nejprve vytvořte leady s kontaktem v pipeline.</p>
        </div>
      </div>
    );
  }

  const call = calls[current];
  const imageUrls = safeJsonParse<string[]>(call.propertyImageUrls, []);
  const redFlags = safeJsonParse<{ type: string; text: string; severity: string }[]>(
    call.analysisRedFlagsJson,
    []
  );
  const hasAnalysis =
    call.analysisNetProfit != null ||
    call.analysisArv != null ||
    call.analysisMarketValue != null;
  const netProfit = call.analysisNetProfit;
  const netProfitColor =
    netProfit != null && netProfit < 0 ? "text-red-400" : "text-emerald-400";
  const verdictLabel = call.analysisVerdictLevel
    ? VERDICT_LABELS[call.analysisVerdictLevel]
    : null;
  const verdictColor = call.analysisVerdictLevel
    ? VERDICT_COLORS[call.analysisVerdictLevel]
    : null;
  const undervalued =
    call.analysisUndervaluationPct != null && call.analysisUndervaluationPct < 0;

  function next() {
    const nextIndex = Math.min(current + 1, calls.length - 1);
    setCurrent(nextIndex);
    setScriptStep(0);
    setCalling(false);
    setNotes(calls[nextIndex]?.notes ?? "");
    setNotesSaved(false);
  }

  async function logOutcome(stage: string) {
    await fetch(`/api/leads/${call.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, notes: notes.trim() || undefined }),
    });
    setCalls((prev) => prev.filter((c) => c.id !== call.id));
    if (current >= calls.length - 1) {
      setCurrent(Math.max(0, calls.length - 2));
    }
    setNotes("");
    setNotesSaved(false);
  }

  async function saveNotes() {
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/leads/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      if (res.ok) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch {}
    setNotesSaving(false);
  }

  function copySms() {
    navigator.clipboard.writeText(smsTemplate).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Call Mode</h1>
          <p className="text-sm text-muted mt-1">{current + 1} z {calls.length} ve frontě</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={calling ? "active" : "idle"} />
          <span className="text-xs text-muted">{calling ? "Hovor aktivní" : "Připraveno"}</span>
        </div>
      </div>

      {meetings.length > 0 && (
        <div className="rounded-2xl border border-blue-500/20 bg-card p-5">
          <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2 mb-3">
            <CalendarBlank size={14} weight="duotone" className="text-blue-400" />
            Nadcházející schůzky
            <span className="text-xs text-muted font-normal">({meetings.length})</span>
          </h2>
          <div className="space-y-2">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-card-hover border border-border/30 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{m.propertyTitle ?? m.contactName ?? "Neznámá nemovitost"}</p>
                  <p className="text-[10px] text-muted truncate">
                    {m.contactName ? `${m.contactName}${m.contactPhone ? ` · ${m.contactPhone}` : ""}` : m.propertyAddress}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-blue-400">
                    {m.meeting.date ? new Date(m.meeting.date).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" }) : "—"}{" "}
                    {m.meeting.date ? new Date(m.meeting.date).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                  {m.meeting.location && <p className="text-[10px] text-muted truncate max-w-[180px]">{m.meeting.location}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={call.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: "spring" as const, stiffness: 100, damping: 20 }}
          className="space-y-4"
        >
          {/* Wide property card */}
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3">
              {/* Photo */}
              <div className="relative h-56 lg:h-full lg:min-h-[300px]">
                <PropertyImage
                  src={imageUrls[0]}
                  alt={call.propertyTitle ?? "Nemovitost"}
                  score={call.analysisScore}
                  removed={call.propertyRemoved}
                  containerClassName="h-full w-full"
                  showScore={false}
                />
                <div className="absolute top-3 left-3 z-10 glass rounded-xl px-3 py-2 flex items-center gap-2">
                  <ScoreGauge score={call.analysisScore ?? 0} size={36} strokeWidth={3} />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted font-mono">skóre</span>
                    <span className="text-sm font-semibold">{call.analysisScore ?? 0}/100</span>
                  </div>
                </div>
              </div>

              {/* Basic info */}
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="font-semibold tracking-tight mb-1">{call.propertyTitle ?? "Neznámá nemovitost"}</h2>
                  {call.propertyAddress && (
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <MapPin size={12} weight="bold" />
                      {call.propertyAddress}
                    </div>
                  )}
                </div>
                {call.propertyRemoved && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
                    <Prohibit size={14} weight="fill" className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted leading-relaxed">
                      Inzerát byl odstraněn z portálu — pravděpodobně se prodal. Ověřte stav úvodem hovoru.
                    </p>
                  </div>
                )}
                {call.propertyPrice != null && <PriceTag price={call.propertyPrice} perSqm={call.propertyPricePerSqm ?? undefined} size="sm" />}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                    <span className="text-[10px] text-muted">Plocha</span>
                    <p className="font-mono font-medium text-xs">{call.propertyArea ? `${call.propertyArea} m²` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                    <span className="text-[10px] text-muted">Dispozice</span>
                    <p className="font-medium text-xs">{call.propertyRooms ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                    <span className="text-[10px] text-muted">Patro</span>
                    <p className="font-medium text-xs">{call.propertyFloor != null ? `${call.propertyFloor}.` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                    <span className="text-[10px] text-muted">Rok</span>
                    <p className="font-medium text-xs">{call.propertyYearBuilt ?? "—"}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                    <span className="text-[10px] text-muted">Stav</span>
                    <p className="font-medium text-xs">{call.propertyCondition ? conditionLabel(call.propertyCondition) : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                    <span className="text-[10px] text-muted">Cena / m²</span>
                    <p className="font-mono font-medium text-xs">
                      {call.propertyPricePerSqm ? `${new Intl.NumberFormat("cs-CZ").format(call.propertyPricePerSqm)} Kč` : "—"}
                    </p>
                  </div>
                </div>
                {call.propertyDescription && (
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">{call.propertyDescription}</p>
                )}
                {call.propertyUrl?.startsWith("http") && (
                  <a
                    href={call.propertyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline transition-colors"
                  >
                    <ArrowUpRight size={12} weight="bold" />
                    Zobrazit na {call.propertyPortal ?? "portálu"}
                  </a>
                )}
              </div>

              {/* Saved analysis */}
              <div className="p-5 border-t lg:border-t-0 lg:border-l border-border/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold tracking-tight text-sm flex items-center gap-2">
                    <ChartLineUp size={14} weight="duotone" className="text-accent" />
                    Uložená analýza
                  </h3>
                  {call.analysisUpdatedAt && (
                    <span className="text-[10px] text-muted">uloženo {formatRelative(call.analysisUpdatedAt)}</span>
                  )}
                </div>

                {hasAnalysis ? (
                  <div className="space-y-3">
                    {verdictLabel && (
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${verdictColor}`}>
                        {verdictLabel}
                      </span>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-semibold font-mono tracking-tight ${netProfitColor}`}>
                        {netProfit != null ? formatCompactPrice(netProfit) : "—"}
                      </span>
                      <span className="text-xs text-muted">čistý zisk</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="ROI" value={call.analysisRoi != null ? `${call.analysisRoi.toFixed(1)} %` : "—"} />
                      <Stat
                        label="Podhodnocení"
                        value={call.analysisUndervaluationPct != null ? `${Math.abs(call.analysisUndervaluationPct).toFixed(1)} %` : "—"}
                        valueClass={undervalued ? "text-emerald-400" : undefined}
                      />
                      <Stat label="ARV" value={call.analysisArv != null ? formatCompactPrice(call.analysisArv) : "—"} />
                      <Stat label="Tržní hodnota" value={call.analysisMarketValue != null ? formatCompactPrice(call.analysisMarketValue) : "—"} />
                      <Stat label="Break-even" value={call.analysisBreakEvenPrice != null ? formatCompactPrice(call.analysisBreakEvenPrice) : "—"} />
                      <Stat label="Cílová nákupní" value={call.analysisTargetPurchasePrice != null ? formatCompactPrice(call.analysisTargetPurchasePrice) : "—"} />
                      <Stat label="Renovace" value={call.analysisRenovationCost != null ? formatCompactPrice(call.analysisRenovationCost) : "—"} />
                      <Stat label="Celkové náklady" value={call.analysisTotalCost != null ? formatCompactPrice(call.analysisTotalCost) : "—"} />
                      <Stat label="Rental yield" value={call.analysisRentalYield != null ? `${call.analysisRentalYield.toFixed(1)} %` : "—"} />
                      <Stat label="Cash on cash" value={call.analysisCashOnCash != null ? `${call.analysisCashOnCash.toFixed(1)} %` : "—"} />
                    </div>
                    {call.analysisVerdictSummary && (
                      <p className="text-xs text-muted leading-relaxed line-clamp-2">{call.analysisVerdictSummary}</p>
                    )}
                    {redFlags.length > 0 && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
                        <span className="font-semibold">{redFlags.length}×</span> {redFlags[0].text}
                      </div>
                    )}
                    {(call.analysisMarketPriceMin != null || call.analysisMarketPriceMax != null) && (
                      <p className="text-[11px] text-muted">
                        Trh:{" "}
                        {call.analysisMarketPriceMin != null && call.analysisMarketPriceMax != null
                          ? `${formatCompactPrice(call.analysisMarketPriceMin)} – ${formatCompactPrice(call.analysisMarketPriceMax)}`
                          : call.analysisMarketPriceMin != null
                          ? `${formatCompactPrice(call.analysisMarketPriceMin)} +`
                          : `${formatCompactPrice(call.analysisMarketPriceMax ?? 0)} max`}
                        {call.analysisMarketSource ? ` · ${call.analysisMarketSource}` : ""}
                        {call.analysisMarketSampleSize ? ` · n=${call.analysisMarketSampleSize}` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 text-center">
                    <p className="text-xs text-muted">Žádná uložená analýza</p>
                    <p className="text-[10px] text-muted mt-1">Spočtěte ji v detailu nemovitosti.</p>
                  </div>
                )}

                {call.propertyId && (
                  <Link
                    href={`/properties/${call.propertyId}`}
                    className="mt-4 inline-block text-xs text-accent hover:underline transition-colors"
                  >
                    Otevřít detail →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Call row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border/50 card-gradient-accent p-6 flex flex-col items-center justify-center lg:col-span-1">
            <span className="text-xs text-muted mb-6">Probíhající hovor</span>
            <motion.div
              animate={calling ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 border border-accent/20 mb-4"
            >
              <Phone size={32} className="text-accent" weight="fill" />
            </motion.div>
            <h2 className="text-xl font-semibold tracking-tight">{call.contactName ?? "Neznámý"}</h2>
            <p className="text-sm text-muted mb-6">{call.contactPhone ?? "—"}</p>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setCalling(!calling)}
              className={`flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
                calling
                  ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                  : "bg-accent/20 border-2 border-accent shadow-[0_0_30px_rgba(16,185,129,0.3)]"
              }`}
            >
              {calling ? <PhoneSlash size={24} className="text-red-400" weight="fill" /> : <Phone size={24} className="text-accent" weight="fill" />}
            </motion.button>

            <div className="flex gap-2 mt-6 flex-wrap justify-center">
              {outcomes
                .filter((o) => o.from.includes(call.stage))
                .map((o) => (
                  <button
                    key={o.label}
                    onClick={() => logOutcome(o.stage)}
                    className={`text-xs px-3 py-1.5 rounded-full border bg-card/50 ${o.color} transition-colors`}
                  >
                    {o.label}
                  </button>
                ))}
            </div>

            <button
              onClick={next}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mt-6"
            >
              <SkipForward size={14} weight="bold" />
              Přeskočit
            </button>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <span className="text-xs text-muted mb-4 block">Script hovoru</span>
              <div className="space-y-2">
                {scriptSteps.map((step, i) => (
                  <button
                    key={i}
                    onClick={() => setScriptStep(i)}
                    className={`w-full text-left flex gap-3 p-3 rounded-xl border transition-all ${
                      scriptStep === i ? "border-accent/30 bg-accent/5" : "border-transparent hover:bg-card-hover"
                    }`}
                  >
                    <span className={`text-xs font-mono shrink-0 w-4 mt-0.5 ${scriptStep === i ? "text-accent" : "text-muted"}`}>{i + 1}.</span>
                    <p className={`text-sm ${scriptStep === i ? "text-foreground" : "text-muted"}`}>{step}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted">SMS šablona</span>
                <button onClick={copySms} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
                  {copied ? <Check size={12} weight="bold" /> : <Copy size={12} weight="bold" />}
                  {copied ? "Zkopírováno" : "Kopírovat"}
                </button>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{smsTemplate}</p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted">Poznámky</span>
                <button
                  onClick={saveNotes}
                  disabled={notesSaving}
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                >
                  {notesSaving ? (
                    "Ukládám..."
                  ) : notesSaved ? (
                    <span className="flex items-center gap-1">
                      <Check size={12} weight="bold" /> Uloženo
                    </span>
                  ) : (
                    "Uložit poznámky"
                  )}
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesSaved(false);
                }}
                className="w-full h-20 resize-none rounded-xl bg-card border border-border/50 p-3 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="Zapište poznámky z hovoru..."
              />
            </div>
          </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
