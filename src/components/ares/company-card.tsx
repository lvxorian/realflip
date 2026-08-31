"use client";

import Link from "next/link";
import { ArrowSquareOut, NotePencil } from "@phosphor-icons/react";
import { ScoreBadge } from "@/components/isir/score-badge";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { AresCompany } from "@/lib/ares/types";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  LIKVIDACE: { label: "V likvidaci", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  EXEKUCE: { label: "Exekuce", className: "bg-red-500/15 text-red-400 border-red-500/20" },
  ZANIKLY: { label: "Zaniká", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
};

const PIPELINE_CONFIG: Record<string, { label: string; className: string }> = {
  new: { label: "Nový", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  contacted: { label: "Kontaktován", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  offer_sent: { label: "Nabídka", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  closed: { label: "Uzavřeno", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  lost: { label: "Prohráno", className: "bg-red-500/15 text-red-400 border-red-500/20" },
};

export function CompanyCard({ company }: { company: AresCompany }) {
  const pipeline = PIPELINE_CONFIG[company.pipeline] ?? PIPELINE_CONFIG.new;
  const status = STATUS_CONFIG[company.status] ?? STATUS_CONFIG.LIKVIDACE;
  const isHigh = company.score >= 70;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900",
        (company.pipeline === "new" || !company.pipeline) && "border-l-2 border-l-emerald-500",
        isHigh && "ring-1 ring-emerald-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ScoreBadge score={company.score} />
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", status.className)}>
              {status.label}
            </span>
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", pipeline.className)}>
              {pipeline.label}
            </span>
            {company.hasExecution && (
              <span className="inline-flex items-center rounded-full border border-red-700 bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-300">
                exekuce
              </span>
            )}
            {company.apartmentFound ? (
              <span className="inline-flex items-center rounded-full border border-emerald-700 bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-300">
                Byt v majetku
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
                Majetek neověřen
              </span>
            )}
          </div>

          <Link
            href={`/ares/${company.id}`}
            className="block text-sm font-medium text-zinc-100 hover:text-emerald-400"
          >
            {company.name ?? `IČO ${company.ico}`}
          </Link>

          <p className="mt-1 text-xs text-zinc-500">
            IČO {company.ico}
            {company.legalForm ? ` · ${LegalFormLabel(company.legalForm)}` : ""}
            {company.spisovaZnacka ? ` · ${company.spisovaZnacka}` : ""}
          </p>

          {company.reasoning && (
            <p className="mt-1 text-xs text-zinc-400">
              {truncate(company.reasoning, 100)}
            </p>
          )}

          <p className="mt-1 text-xs text-zinc-600">
            {company.sidlo ? `${company.sidlo} · ` : ""}
            {company.liquidationDate
              ? `Likvidace ${formatRelative(company.liquidationDate)}`
              : "Detekováno v posledním skenu"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`https://ares.gov.cz/ekonomicke-subjekty/ico/${company.ico}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            title="Otevřít ARES"
          >
            <ArrowSquareOut className="h-4 w-4" />
          </Link>
          <Link
            href={`/ares/${company.id}`}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            title="Detail"
          >
            <NotePencil className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LegalFormLabel(code: string | null): string {
  const map: Record<string, string> = {
    "112": "s.r.o.",
    "121": "a.s.",
    "706": "spolek",
    "117": "spolek",
    "129": "o.p.s.",
    "101": "fyzická osoba",
  };
  return map[code ?? ""] ?? (code ?? "");
}
