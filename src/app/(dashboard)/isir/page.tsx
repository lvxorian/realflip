"use client";

import { useState, useEffect } from "react";
import { Funnel, ArrowClockwise, Scales, Play } from "@phosphor-icons/react";
import { InsolvencyCard } from "@/components/isir/insolvency-card";
import { cn, formatRelative } from "@/lib/utils";
import type { InsolvencyEvent } from "@/lib/isir/types";

export interface IsirPollInfo {
  id: string;
  status: string;
  startedAt: number;
  finishedAt: number | null;
  eventsFound: number;
  apartmentsFound: number;
  lastPodnetId: number | null;
  error: string | null;
}

const SECTION_FILTERS = [
  { value: "", label: "Vše" },
  { value: "A", label: "Sekce A" },
  { value: "B", label: "Sekce B" },
  { value: "D", label: "Sekce D" },
];

const STATUS_FILTERS = [
  { value: "", label: "Vše" },
  { value: "new", label: "Nové" },
  { value: "contacted", label: "Kontaktováno" },
  { value: "offer_sent", label: "Nabídka" },
  { value: "closed", label: "Uzavřeno" },
];

const SCORE_FILTERS = [
  { value: 0, label: "Vše" },
  { value: 50, label: "≥50" },
  { value: 70, label: "≥70" },
  { value: 85, label: "≥85" },
];

export default function InsolvencePage() {
  const [events, setEvents] = useState<InsolvencyEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPoll, setLastPoll] = useState<IsirPollInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const limit = 50;

  useEffect(() => {
    const params = new URLSearchParams();
    if (section) params.set("section", section);
    if (status) params.set("status", status);
    if (minScore > 0) params.set("minScore", String(minScore));
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/isir/documents?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [section, status, minScore, page]);

  useEffect(() => {
    fetch("/api/isir/polls")
      .then((r) => r.json())
      .then((data) => setLastPoll(data.polls?.[0] ?? null))
      .catch(() => {});
  }, []);

  const triggerScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      await fetch("/api/isir/trigger", { method: "POST" });
      const res = await fetch("/api/isir/polls");
      const data = await res.json();
      setLastPoll(data.polls?.[0] ?? null);
      refresh();
    } finally {
      setScanning(false);
    }
  };

  function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (section) params.set("section", section);
    if (status) params.set("status", status);
    if (minScore > 0) params.set("minScore", String(minScore));
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/isir/documents?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
            <Scales className="h-6 w-6 text-amber-400" />
            Insolvence
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Insolvenční rejstřík — {total} příležitostí
          </p>
          <div className="mt-1 text-xs text-zinc-600">
            {lastPoll ? PollStatusLine(lastPoll) : "Zatím žádný záznam o skenování"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <Play className={cn("h-3.5 w-3.5", scanning && "animate-pulse")} />
            {scanning ? "Skenuji..." : "Spustit sken"}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            <ArrowClockwise className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Obnovit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Funnel className="h-4 w-4 text-zinc-600" />

        {/* Score filter */}
        {SCORE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setMinScore(f.value); setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              minScore === f.value
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
            )}
          >
            {f.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-zinc-700" />

        {/* Section filter */}
        {SECTION_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setSection(f.value); setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              section === f.value
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
            )}
          >
            {f.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-zinc-700" />

        {/* Status filter */}
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              status === f.value
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Scales className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">Žádné insolvence nenalezeny</p>
          <p className="mt-1 text-xs text-zinc-600">
            Spusťte cron job nebo počkejte na další data
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <InsolvencyCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
          >
            Předchozí
          </button>
          <span className="text-xs text-zinc-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
          >
            Další
          </button>
        </div>
      )}
    </div>
  );
}

function PollStatusLine(poll: IsirPollInfo): React.ReactNode {
  const when = poll.finishedAt
    ? `Poslední sken ${formatRelative(poll.finishedAt)}`
    : `Sken běží od ${new Date(poll.startedAt).toLocaleTimeString("cs-CZ")}`;

  const state =
    poll.status === "running" ? (
      <span className="text-amber-400">probíhá</span>
    ) : poll.status === "failed" ? (
      <span className="text-rose-400">selhal</span>
    ) : (
      <span className="text-emerald-400">dokončeno</span>
    );

  const summary = poll.lastPodnetId
    ? ` · ${poll.eventsFound} událostí, ${poll.apartmentsFound} bytů, do ID ${poll.lastPodnetId}`
    : "";

  return (
    <>
      {when} · stav {state}
      {summary}
    </>
  );
}
