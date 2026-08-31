"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { ChartLineUp, SpinnerGap, Lightning } from "@phosphor-icons/react";

interface ScanRecord {
  id: string;
  scanId: string;
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

export function RealingoScanPanel({ propertyId }: { propertyId: string }) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/realingo/scans/${propertyId}`);
      const data = await res.json();
      setScans(data.scans ?? []);
    } catch {
      setScans([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/realingo/scans/${propertyId}`);
        const data = await res.json();
        if (active) setScans(data.scans ?? []);
      } catch {
        if (active) setScans([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [propertyId]);

  const runScan = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/realingo/scans/${propertyId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "RealScan selhal");
      } else {
        await load();
      }
    } catch {
      setError("RealScan selhal — zkuste znovu");
    } finally {
      setRunning(false);
    }
  };

  const latest = scans[0];

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ChartLineUp size={18} weight="fill" className="text-accent" />
          <h2 className="font-semibold tracking-tight text-sm">RealScan — tržní odhad</h2>
        </div>
        <Button size="sm" onClick={runScan} disabled={running}>
          {running ? (
            <>
              <SpinnerGap size={14} className="animate-spin" />
              Odhaduji...
            </>
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
      ) : latest?.status === "DONE" || latest?.status === "COMPLETED" || latest?.result ? (
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
              Srovnávače nabídek v okolí k dispozici
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
