"use client";

import { useState } from "react";
import { Sparkle, ArrowsClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ReportData {
  content: string;
  generatedAt: number;
}

interface Props {
  regionKey: string;
  range: string;
}

/** AI Market Report — zobrazí cache, tlačítko Obnovit regeneruje. */
export function ReportCard({ regionKey, range }: Props) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  async function load(force: boolean) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/market/report?region=${encodeURIComponent(regionKey)}&range=${encodeURIComponent(range)}${force ? "&force=1" : ""}`,
        { method: force ? "POST" : "GET", cache: "no-store" }
      );
      if (!res.ok) {
        setReport(null);
        if (force) toast.error("Zprávu se nepodařilo vygenerovat (model je vytížený)");
        return;
      }
      const data = (await res.json()) as ReportData;
      setReport(data);
      if (force) toast.success("Zpráva byla obnovena");
    } catch {
      setReport(null);
      if (force) toast.error("Chyba sítě");
    } finally {
      setLoading(false);
    }
  }

  const reload = () => {
    setRegenerating(true);
    load(true).finally(() => setRegenerating(false));
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkle size={16} className="text-accent" weight="duotone" />
        <span className="font-medium">AI Market Report</span>
        <span className="text-xs text-muted ml-auto">
          {report ? `generováno ${new Date(report.generatedAt).toLocaleDateString("cs-CZ")}` : "Generováno na vyžádání (Gemini)"}
        </span>
        <button
          onClick={reload}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          <ArrowsClockwise size={13} className={cn(regenerating && "animate-spin")} />
          Obnovit
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/3 rounded" />
        </div>
      ) : report ? (
        <div className="prose prose-invert max-w-none prose-sm prose-headings:text-sm prose-headings:mt-4 prose-headings:first:mt-0 prose-p:my-2 prose-strong:text-foreground">
          {report.content.split("\n").map((line, i) => {
            const isHeading = line.startsWith("**") && line.endsWith("**");
            if (isHeading) return <p key={i} className="font-semibold text-sm mt-4 mb-1 text-foreground">{line.replace(/\*\*/g, "")}</p>;
            if (line.startsWith("- ")) return <p key={i} className="my-1.5 pl-2 text-muted-foreground">{line}</p>;
            if (!line.trim()) return null;
            return <p key={i} className="my-2 text-foreground/85">{line}</p>;
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">Zpráva není k dispozici — klikněte na „Obnovit“.</p>
      )}
    </div>
  );
}