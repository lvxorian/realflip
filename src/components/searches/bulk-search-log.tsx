"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowsClockwise, CheckCircle, WarningCircle, SpinnerGap, MagnifyingGlass, Clock,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn, portalLabel } from "@/lib/utils";
import { PORTAL_CONFIGS, type PortalName } from "@/lib/scraping/types";
import type { ScrapeProgressEvent } from "@/lib/scraping/orchestrator";

interface PortalState {
  status: "pending" | "running" | "done" | "failed";
  found: number;
  errors: string[];
}

interface SearchState {
  id: string;
  name: string;
  index: number;
  status: "running" | "done";
  found: number;
  errors: string[];
  portals: Partial<Record<PortalName, PortalState>>;
}

type Phase = "running" | "done" | "interrupted" | "error";

/** Kolik běhů celkem může auto-pokračování udělat, než se vzdá.
 *  Každý běh teď navazuje (skipSearchIds + skipPortals), takže se neleze
 *  znovu to, co už proběhlo — 12 běhů × 60 s stačí i pro pomalé portály
 *  (sreality crawleje po městech, reality.cz má přísný rate limit). */
const MAX_RETRIES = 12;
/** Pauza mezi běhy, aby server stihl uvolnit prostředky. */
const RETRY_DELAY_MS = 3000;

const ENABLED_PORTALS = (Object.keys(PORTAL_CONFIGS) as PortalName[]).filter(
  (p) => PORTAL_CONFIGS[p].enabled
);

function parseSseEvent(raw: string): { event: string; data: unknown } | null {
  let event = "";
  let dataStr = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
  }
  if (!dataStr) return null;
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}

function elapsedText(startedAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}

function PortalChip({ portal, state }: { portal: PortalName; state?: PortalState }) {
  const status = state?.status ?? "pending";
  return (
    <span
      title={
        status === "failed"
          ? `${portalLabel(portal)}: ${state?.errors.join(" | ") ?? "chyba"}`
          : status === "done"
            ? `${portalLabel(portal)}: ${state?.found ?? 0} inzerátů`
            : portalLabel(portal)
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
        status === "pending" && "border-border/30 text-muted/50",
        status === "running" && "border-accent/40 bg-accent/5 text-accent",
        status === "done" && "border-emerald-500/25 bg-emerald-500/5 text-emerald-400",
        status === "failed" && "border-red-500/30 bg-red-500/5 text-red-400"
      )}
    >
      {status === "running" && <SpinnerGap size={9} weight="bold" className="animate-spin" />}
      {status === "done" && <CheckCircle size={9} weight="fill" />}
      {status === "failed" && <WarningCircle size={9} weight="fill" />}
      {portalLabel(portal)}
      {(status === "done" || status === "failed") && state?.found ? ` ${state.found}` : ""}
    </span>
  );
}

export function BulkSearchLog({
  open,
  onClose,
  onFinished,
  url = "/api/searches/run-all",
  title = "Hromadné hledání",
  maxRetries = MAX_RETRIES,
  retryDelayMs = RETRY_DELAY_MS,
}: {
  open: boolean;
  onClose: () => void;
  onFinished: () => void;
  /** SSE endpoint — hromadné (výchozí) nebo jednotlivé hledání. */
  url?: string;
  title?: string;
  /** Kolik běhů celkem může auto-pokračování udělat, než se vzdá (testy). */
  maxRetries?: number;
  /** Pauza mezi běhy, aby server stihl uvolnit prostředky (testy). */
  retryDelayMs?: number;
}) {
  const [phase, setPhase] = useState<Phase>("running");
  const [searches, setSearches] = useState<SearchState[]>([]);
  const [result, setResult] = useState<{ total: number; runCount: number; failed: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [retryCount, setRetryCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const doneReceivedRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef<Phase>("running");
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // Hledání, která už proběhla (dostala search-done) — při auto-pokračování
  // se pošlou serveru, aby je přeskočil a dojel jen zbývající.
  const doneSearchIdsRef = useRef<Set<string>>(new Set());

  // Portály už dokončené pro každé hledání (dostaly portal událost s 0 chyb) —
  // při auto-pokračování se pošlou serveru, aby je nepřelezal znovu a běh
  // navazoval místo restartu od nuly (každý pokus je tak rychlejší).
  const donePortalsRef = useRef<Map<string, string[]>>(new Map());

  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const applyProgress = useCallback((ev: ScrapeProgressEvent) => {
    setSearches((prev) => {
      const next = [...prev];
      if (ev.kind === "search-start") {
        const existing = next.find((s) => s.id === ev.searchId);
        const entry: SearchState = {
          id: ev.searchId,
          name: ev.searchName,
          index: ev.index,
          status: "running",
          // Při auto-pokračování si zachováme už hotové portály z minulých běhů
          // (server je znovu neposílá — přeskočené se nemají zobrazit jako pending).
          found: existing?.found ?? 0,
          errors: existing?.errors ?? [],
          portals: {
            ...(Object.fromEntries(ENABLED_PORTALS.map((p) => [p, undefined])) as SearchState["portals"]),
            ...(existing?.portals ?? {}),
          },
        };
        if (existing) {
          next[next.indexOf(existing)] = entry;
        } else {
          next.push(entry);
        }
        next.sort((a, b) => a.index - b.index);
        return next;
      }
      const entry = next.find((s) => s.id === ev.searchId);
      if (!entry) return prev;
      if (ev.kind === "portal") {
        entry.portals = {
          ...entry.portals,
          [ev.portal]: {
            status: ev.errors.length > 0 ? "failed" : "done",
            found: ev.found,
            errors: ev.errors,
          },
        };
        // Součet nalezených napříč portály — při auto-pokračování se sčítá
        // za všechny běhy (search-done po přeskočených portálech by vrátil 0).
        entry.found += ev.found;
        // Dokončený portál si zapamatujeme pro auto-pokračování — při dalším
        // běhu se serveru pošle, aby ho nepřelezal znovu. Chybové portály se
        // nepřeskočí (zkusí se znovu — mohla to být přechodná chyba).
        if (ev.errors.length === 0) {
          const list = donePortalsRef.current.get(ev.searchId) ?? [];
          if (!list.includes(ev.portal)) {
            list.push(ev.portal);
            donePortalsRef.current.set(ev.searchId, list);
          }
        }
      } else if (ev.kind === "search-done") {
        entry.status = "done";
        entry.errors = ev.errors;
        doneSearchIdsRef.current.add(ev.searchId);
      }
      return next;
    });
  }, []);

  const handleRawEvent = useCallback(
    (raw: string) => {
      const parsed = parseSseEvent(raw);
      if (!parsed) return;
      const { event, data } = parsed;
      if (event === "progress") {
        applyProgress(data as ScrapeProgressEvent);
      } else if (event === "done") {
        doneReceivedRef.current = true;
        setResult(data as { total: number; runCount: number; failed: string[] });
        setPhaseSafe("done");
      } else if (event === "error") {
        setErrorMsg(typeof (data as { message?: unknown })?.message === "string" ? (data as { message: string }).message : "Neočekávaná chyba");
        setPhaseSafe("error");
      }
    },
    [applyProgress]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    doneReceivedRef.current = false;
    finishedRef.current = false;
    doneSearchIdsRef.current = new Set();
    donePortalsRef.current = new Map();
    setPhaseSafe("running");
    setSearches([]);
    setResult(null);
    setErrorMsg(null);
    setRetryCount(0);
    startedAtRef.current = Date.now();
    setNow(Date.now());

    async function runOnce(controller: AbortController): Promise<"done" | "interrupted" | "error"> {
      try {
        const res = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          // Auto-pokračování: přeskoč hledání, která už proběhla, i portály,
          // které už v nich proběhly — každý běh navazuje, místo restartu.
          body: JSON.stringify({
            skipSearchIds: Array.from(doneSearchIdsRef.current),
            skipPortals: Object.fromEntries(donePortalsRef.current),
          }),
        });
        if (!res.ok || !res.body) {
          if (cancelled) return "interrupted";
          setErrorMsg(`HTTP ${res.status}`);
          setPhaseSafe("error");
          return "error";
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep;
          while ((sep = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            if (cancelled) return "interrupted";
            handleRawEvent(raw);
          }
        }
        if (doneReceivedRef.current || phaseRef.current !== "running") return "done";
        // Stream skončil bez „done" — server běh přerušil (Vercel limit 60 s).
        return "interrupted";
      } catch {
        if (cancelled || phaseRef.current !== "running") return "interrupted";
        return "interrupted";
      }
    }

    async function run() {
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cancelled) return;
        if (attempt > 0) {
          setPhaseSafe("running");
          setRetryCount(attempt);
        }

        const controller = new AbortController();
        abortRef.current = controller;

        const outcome = await runOnce(controller);
        if (cancelled) return;
        if (outcome === "done" || outcome === "error") break;

        // Přerušeno (limit 60 s): počkáme a automaticky dojedeme zbývající
        // hledání — uživatel nemusí spouštět hromadné hledání znovu ručně.
        attempt++;
        if (attempt >= maxRetries) {
          setPhaseSafe("interrupted");
          break;
        }
        await new Promise((r) => setTimeout(r, retryDelayMs));
        if (cancelled) return;
      }
      if (!cancelled && !finishedRef.current) {
        finishedRef.current = true;
        onFinishedRef.current();
      }
    }
    void run();

    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      clearInterval(tick);
      abortRef.current?.abort();
    };
  }, [open, url]);

  const doneCount = searches.filter((s) => s.status === "done").length;
  const progressPct = searches.length > 0 ? Math.round((doneCount / searches.length) * 100) : 0;

  const running = phase === "running";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={running ? undefined : onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border/50 bg-background shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]"
            >
              {/* Hlavička */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      running ? "bg-accent/10 text-accent" : phase === "done" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    )}
                  >
                    {running ? (
                      <SpinnerGap size={16} weight="bold" className="animate-spin" />
                    ) : phase === "done" ? (
                      <CheckCircle size={16} weight="fill" />
                    ) : (
                      <WarningCircle size={16} weight="fill" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate">{title}</h3>
                    <p className="text-[11px] text-muted flex items-center gap-1">
                      <Clock size={10} weight="bold" />
                      {elapsedText(startedAtRef.current, now)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {phase === "done" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                      <CheckCircle size={10} weight="fill" /> Dokončeno
                    </span>
                  )}
                  {phase === "interrupted" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/25 px-2 py-1 text-[10px] font-semibold text-amber-400">
                      <WarningCircle size={10} weight="fill" /> Přerušeno
                    </span>
                  )}
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card text-muted transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Obsah */}
              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                {/* Progress bar */}
                {searches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-[11px] text-muted">
                      <span>
                        Dokončeno {doneCount} z {searches.length} hledání
                      </span>
                      <span className="font-mono">{progressPct} %</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border/15 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-accent"
                        animate={{ width: `${Math.max(progressPct, 4)}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Přehled chyb / varování */}
                {phase === "interrupted" && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/90 leading-relaxed">
                    Server přerušil běh (limit 60 s) i po {maxRetries} automatických pokusech.
                    Uložené výsledky zůstávají v databázi — proběhlá hledání můžete spustit znovu
                    a zbytek se doplní.
                  </div>
                )}
                {phase === "running" && retryCount > 0 && (
                  <div className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-xs text-accent/90 leading-relaxed flex items-center gap-2">
                    <SpinnerGap size={13} weight="bold" className="animate-spin shrink-0" />
                    <span>
                      Limit 60 s byl překročen — {retryCount}. běh dojíždí zbývající hledání
                      automaticky ({maxRetries - retryCount} pokusů zbývá).
                    </span>
                  </div>
                )}
                {phase === "error" && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-xs text-red-400 leading-relaxed">
                    Hromadné hledání selhalo: {errorMsg ?? "neznámá chyba"}
                  </div>
                )}

                {/* Seznam hledání */}
                {searches.length === 0 ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-16 rounded-xl bg-border/10 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                    <p className="text-xs text-muted/60 text-center pt-1">Připravuji hledání…</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {searches.map((s) => (
                      <div key={s.id} className="rounded-xl border border-border/40 px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("shrink-0", s.status === "done" ? "text-emerald-400" : "text-accent")}>
                              {s.status === "done" ? (
                                <CheckCircle size={13} weight="fill" />
                              ) : (
                                <SpinnerGap size={13} weight="bold" className="animate-spin" />
                              )}
                            </span>
                            <span className="text-xs font-medium truncate">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.errors.length > 0 && (
                              <span className="text-[10px] text-red-400" title={s.errors.join(" | ")}>
                                {s.errors.length} chyb
                              </span>
                            )}
                            {s.status === "done" && (
                              <span className="text-[10px] font-mono text-emerald-400">
                                +{s.found} inzerátů
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ENABLED_PORTALS.map((p) => (
                            <PortalChip key={p} portal={p} state={s.portals[p]} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patička */}
              <div className="px-5 py-4 border-t border-border/40 flex items-center justify-between gap-3">
                <div className="text-[11px] text-muted min-w-0">
                  {phase === "done" && result && (
                    <span>
                      <span className="text-emerald-400 font-semibold">{result.total} inzerátů</span> napříč{" "}
                      {result.runCount} hledáními
                      {result.failed.length > 0 && (
                        <span className="text-amber-400"> · {result.failed.length} hledání selhalo</span>
                      )}
                    </span>
                  )}
                  {phase === "running" && <span>Běží — výsledky se ukládají průběžně.</span>}
                  {(phase === "interrupted" || phase === "error") && (
                    <span className="flex items-center gap-1.5">
                      <MagnifyingGlass size={11} className="shrink-0 text-muted/60" />
                      Částečné výsledky najdete v seznamu hledání.
                    </span>
                  )}
                </div>
                <Button
                  variant={phase === "done" ? "default" : "secondary"}
                  size="sm"
                  onClick={onClose}
                  disabled={running}
                  className="shrink-0 gap-1.5"
                >
                  {phase === "done" && <CheckCircle size={13} weight="bold" />}
                  {phase === "running" ? "Probíhá…" : "Zavřít"}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
