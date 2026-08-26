"use client";

import Link from "next/link";
import { Archive, Plus, ArrowSquareOut } from "@phosphor-icons/react";
import { CategoryBadge, RelevanceBadge } from "./category-badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface DeskaDoc {
  id: string;
  edeskyId: string;
  name: string;
  dashboardName: string | null;
  category: string;
  relevance: string;
  keywordsMatched: string | null;
  origUrl: string | null;
  edeskyUrl: string | null;
  createdAtDeska: string | null;
  scrapedAt: number;
  isRead: number;
  isArchived: number;
  address: string | null;
  propertyId: string | null;
  leadId: string | null;
}

export function DeskaCard({
  doc,
  onArchive,
  onCreateProperty,
}: {
  doc: DeskaDoc;
  onArchive?: (id: string) => void;
  onCreateProperty?: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!onCreateProperty || creating) return;
    setCreating(true);
    try {
      await onCreateProperty(doc.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900",
        !doc.isRead && "border-l-2 border-l-emerald-500",
        doc.propertyId && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <CategoryBadge category={doc.category} />
            <RelevanceBadge relevance={doc.relevance} />
            {doc.propertyId && (
              <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                V pipeline
              </span>
            )}
          </div>

          <Link
            href={`/deska/${doc.id}`}
            className="block text-sm font-medium text-zinc-100 hover:text-emerald-400"
          >
            {doc.name}
          </Link>

          <p className="mt-1 text-xs text-zinc-500">{doc.dashboardName}</p>

          {doc.keywordsMatched && (
            <p className="mt-1 text-xs text-zinc-600">
              Keywords: {doc.keywordsMatched}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
            <span>{formatDate(doc.createdAtDeska)}</span>
            {doc.address && <span>· {doc.address}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {doc.edeskyUrl && (
            <a
              href={doc.edeskyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title="Otevřít na edesky.cz"
            >
              <ArrowSquareOut className="h-4 w-4" />
            </a>
          )}
          {!doc.propertyId && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
              title="Přidat do Pipeline"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {!doc.isArchived && (
            <button
              onClick={() => onArchive?.(doc.id)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400"
              title="Archivovat"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  // edesky format: "2025-02-20 17:57:26 +0100"
  const d = new Date(dateStr.replace(" +0100", "+01:00").replace(" +0200", "+02:00"));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}
