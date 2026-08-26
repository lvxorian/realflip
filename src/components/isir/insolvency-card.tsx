"use client";

import Link from "next/link";
import { ArrowSquareOut, NotePencil } from "@phosphor-icons/react";
import { ScoreBadge } from "./score-badge";
import { SectionBadge } from "./section-badge";
import { cn, formatDate, formatRelative, safeJsonParse, truncate } from "@/lib/utils";
import type { InsolvencyEvent } from "@/lib/isir/types";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new: { label: "Nový", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  contacted: { label: "Kontaktován", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  offer_sent: { label: "Nabídka", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  closed: { label: "Uzavřeno", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  lost: { label: "Prohráno", className: "bg-red-500/15 text-red-400 border-red-500/20" },
};

export function InsolvencyCard({ event }: { event: InsolvencyEvent }) {
  const apartment = safeJsonParse<{
    address: string | null;
    disposition: string | null;
    area: number | null;
    cadastralArea: string | null;
    lvNumber: string | null;
    estimatedPrice: number | null;
  }>(event.apartmentData, {});

  const statusConfig = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.new;
  const isHigh = event.score >= 70;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900",
        !event.status || event.status === "new" ? "border-l-2 border-l-emerald-500" : "",
        isHigh && "ring-1 ring-emerald-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ScoreBadge score={event.score} />
            <SectionBadge section={event.section} />
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                statusConfig.className
              )}
            >
              {statusConfig.label}
            </span>
            {apartment.disposition && (
              <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                {apartment.disposition}
              </span>
            )}
          </div>

          <Link
            href={`/isir/${event.id}`}
            className="block text-sm font-medium text-zinc-100 hover:text-emerald-400"
          >
            {event.spisovaZnacka}
          </Link>

          <p className="mt-1 text-xs text-zinc-500">
            {event.eventDesc ? truncate(event.eventDesc, 80) : event.eventType}
          </p>

          {apartment.address && (
            <p className="mt-1 text-xs text-zinc-400">
              {apartment.address}
              {apartment.area ? ` · ${apartment.area} m²` : ""}
            </p>
          )}

          {apartment.estimatedPrice && (
            <p className="mt-1 text-xs font-medium text-emerald-400">
              {new Intl.NumberFormat("cs-CZ").format(apartment.estimatedPrice)} Kč
            </p>
          )}

          <p className="mt-1 text-xs text-zinc-600">
            {formatRelative(event.publishedAt)}
            {event.notes ? ` · ${event.notes}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {event.documentUrl && (
            <a
              href={event.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title="Otevřít dokument"
            >
              <ArrowSquareOut className="h-4 w-4" />
            </a>
          )}
          <Link
            href={`/isir/${event.id}`}
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
