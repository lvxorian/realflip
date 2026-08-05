"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { StatusDot } from "@/components/ui/status-dot";
import { PriceTag } from "@/components/ui/price-tag";
import { conditionLabel } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, PhoneSlash, SkipForward, Copy, Check, MapPin, CalendarBlank } from "@phosphor-icons/react";

interface CallItem {
  id: string;
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
  analysisScore: number | null;
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
          if (l.stage === "meeting" && date) {
            upcoming.push({
              id: l.id,
              contactName: l.contactName ?? null,
              contactPhone: l.contactPhone ?? null,
              propertyTitle: l.propertyTitle ?? null,
              propertyAddress: l.propertyAddress ?? null,
              meeting: { date, location: meeting?.location ?? null },
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
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden lg:col-span-1">
            <div className="relative h-36 property-image-shimmer flex items-center justify-center">
              <ScoreGauge score={call.analysisScore ?? 0} size={40} strokeWidth={3} />
            </div>
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
              </div>
              {call.propertyCondition && <Badge variant="secondary" size="sm">{conditionLabel(call.propertyCondition)}</Badge>}
            </div>
          </div>

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

          <div className="space-y-4 lg:col-span-1">
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
