"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { ChartLineUp, SpinnerGap, Lightning, WarningCircle } from "@phosphor-icons/react";

interface ScanRecord {
  id: string;
  scanId: string | null;
  status: string | null;
  result: {
    avgPrice?: number | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    avgPriceM2?: number | null;
    rangePrice?: number | null;
    searchDistance?: number | null;
    recordsCount?: number | null;
  } | null;
  priceIndex: { date?: string | null; avgPrice?: number | null }[];
  hasComparables: boolean;
  createdAt: number;
}

const RUNNING = new Set(["PENDING", "RUNNING", "QUEUED", "PROCESSING", "CREATED"]);
const FAILED = new Set(["FAILED", "ERROR", "CANCELED", "CANCELLED"]);
const POLL_MS = 6_000;
const MAX_POLL_MS = 5 * 60_000;

function isRunning(s: string | null | undefined): boolean {
  return !!s && RUNNING.has(s.toUpperCase());
}

export function RealingoScanPanel({ propertyId }: { propertyId: string }) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (): Promise<ScanRecord[]> => {
    try {
      const res = await fetch(`/api/realingo/scans/${propertyId}`);
      const data = await res.json();
      const list = (data.scans ?? []) as ScanRecord[];
      setScans(list);
      return list;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  // Dokončování scanu: Realingo počítá minuty → dokud je PENDING, dotahujeme
  // GET (serverní strana lazy-refreshne stav z Realinga do DB).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await load();
      if (cancelled || !list.some((s) => isRunning(s.status))) return;
      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        const fresh = await load();
        const stillPending = fresh.some((s) => isRunning(s.status));
        if (!stillPending || Date.now() - startedAt > MAX_POLL_MS) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, POLL_MS);
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const runScan = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/realingo/scans/${propertyId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "RealScan se nepodařilo spustit.");
        return;
      }
      await load();
      if (data.running && !pollRef.current) {
        const startedAt = Date.now();
        pollRef.current = setInterval(async () => {
          const fresh = await load();
          if (!fresh.some((s) => isRunning(s.status)) || Date.now() - startedAt > MAX_POLL_MS) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }, POLL_MS);
      }
    } catch {
      setError("RealScan selhal — zkontrolujte připojení a zkuste znovu.");
    } finally {
      setRunning(false);
    }
  };

  const latest = scans[0];
  const pending = latest && isRunning(latest.status);
  const failed = latest && FAILED.has((latest.status ?? "").toUpperCase());
  const hasResult = latest?.result?.avgPrice != null;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ChartLineUp size={18} weight="fill" className="text-accent" />
          <h2 className="font-semibold tracking-tight text-sm">RealScan — tržní odhad</h2>
        </div>
        <Button size="sm" onClick={runScan} disabled={running || !!pending}>
          {running || pending ? (
            <>
              <SpinnerGap size={14} className="animate-spin" />
              {pending ? "Probíhá…" : "Spouštím…"}
            </>
          ) : hasResult ? (
            "Spustit znovu"
          ) : (
            "Spustit RealScan"
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="h-16 animate-pulse rounded-lg bg-card-hover" />
      ) : pending ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <SpinnerGap size={16} className="animate-spin text-accent" />
          Počítáme tržní odhad — první výsledek je obvykle do minuty, panel se obnoví automaticky.
        </div>
      ) : failed ? (
        <div className="flex items-start gap-2 text-sm">
          <WarningCircle size={16} weight="fill" className="text-amber-400 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium">Odhad se nepovedl.</p>
            <p className="text-xs text-muted mt-0.5">
              Zkuste RealScan spustit znovu. Pokud problém přetrvá, ověřte předplacený plán Realingo.
            </p>
          </div>
        </div>
      ) : hasResult ? (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-muted mb-1">Odhad tržní hodnoty</p>
            <p className="text-2xl font-semibold tracking-tight">
              {formatPrice(latest.result?.avgPrice ?? 0)}
              <span className="text-xs text-muted font-normal ml-2">průměr</span>
            </p>
            {latest.result?.avgPriceM2 ? (
              <p className="text-xs text-muted">{formatPrice(latest.result.avgPriceM2)} za m²</p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              {latest.result?.minPrice != null && (
                <span className="text-muted">Min <span className="text-foreground font-medium">{formatPrice(latest.result.minPrice)}</span></span>
              )}
              {latest.result?.maxPrice != null && (
                <span className="text-muted">Max <span className="text-foreground font-medium">{formatPrice(latest.result.maxPrice)}</span></span>
              )}
              {latest.result?.recordsCount != null && (
                <span className="text-muted">Z <span className="text-foreground font-medium">{latest.result.recordsCount} komparací</span></span>
              )}
            </div>
          </div>
          {latest.hasComparables && (
            <div className="flex items-center gap-1.5 text-xs text-accent">
              <Lightning size={13} weight="fill" />
              Srovnávací nabídky v okolí k dispozici
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Zatím bez odhadu pro tuto nemovitost. Spusťte RealScan pro tržní ocenění z Realingo.
        </p>
      )}
    </Card>
  );
}
