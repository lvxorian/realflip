"use client";

import { useState, useCallback } from "react";
import { MagnifyingGlass, X, Plus, Check } from "@phosphor-icons/react";
import { CategoryBadge, RelevanceBadge } from "./category-badge";
import { cn } from "@/lib/utils";

export interface EdeskySearchDoc {
  edesky_id: string;
  name: string;
  dashboard_name?: string | null;
  dashboard_id?: string | null;
  created_at?: string | null;
  edesky_url?: string | null;
  orig_url?: string | null;
  edesky_text_url?: string | null;
}

export function DeskaSearch({
  onSelect,
}: {
  onSelect?: (doc: EdeskySearchDoc) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EdeskySearchDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searched, setSearched] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/deska/search?keywords=${encodeURIComponent(query.trim())}&order=date&includeTexts=1`,
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.documents ?? []);
        setTotalCount(data.totalCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  const saveDocument = async (doc: EdeskySearchDoc) => {
    setSavingId(doc.edesky_id);
    try {
      const res = await fetch("/api/deska/documents/from-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      if (res.ok) {
        setSavedIds((prev) => new Set(prev).add(doc.edesky_id));
        onSelect?.(doc);
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Hledat na úředních deskách... (např. prodej pozemku, dražba, exekuce)"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearched(false);
                setTotalCount(0);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={doSearch}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Hledám..." : "Hledat"}
        </button>
      </div>

      {searched && (
        <div className="mt-3 text-xs text-zinc-500">
          {loading ? "Probíhá vyhledávání..." : `Nalezeno ${totalCount} dokumentů`}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {results.map((doc) => {
            const isSaved = savedIds.has(doc.edesky_id);
            return (
              <div
                key={doc.edesky_id}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:border-zinc-700"
              >
                <button
                  onClick={() => onSelect?.(doc)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <CategoryBadge category={classifyFromSearch(doc.name)} />
                    <RelevanceBadge relevance="MEDIUM" />
                  </div>
                  <p className="text-sm font-medium text-zinc-200">{doc.name}</p>
                  <p className="text-xs text-zinc-500">{doc.dashboard_name}</p>
                  <p className="mt-1 text-xs text-zinc-600">{doc.created_at}</p>
                </button>
                <button
                  onClick={() => saveDocument(doc)}
                  disabled={isSaved || savingId === doc.edesky_id}
                  className={cn(
                    "mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-default",
                    isSaved
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-700 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-400",
                  )}
                >
                  {isSaved ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Uloženo
                    </>
                  ) : savingId === doc.edesky_id ? (
                    "Ukládám..."
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Uložit
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function classifyFromSearch(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("prodej") || lower.includes("odprodej")) return "PRODEJ";
  if (lower.includes("dražba") || lower.includes("drazba")) return "DRAZBA";
  if (lower.includes("exekuce")) return "EXEKUCE";
  if (lower.includes("odúmrtí") || lower.includes("odumrti") || lower.includes("dědic")) return "DEDICTVI";
  if (lower.includes("stavebn") || lower.includes("územní") || lower.includes("kolaudace")) return "STAVEBNI_RIZENI";
  return "JINE";
}
