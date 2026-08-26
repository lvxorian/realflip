"use client";

import { useState, useEffect } from "react";
import { Funnel, Archive, ArrowClockwise } from "@phosphor-icons/react";
import { DeskaCard, type DeskaDoc } from "@/components/deska/deska-card";
import { DeskaSearch } from "@/components/deska/deska-search";
import { WatchManager } from "@/components/deska/watch-manager";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "", label: "Vše" },
  { value: "PRODEJ", label: "Prodeje" },
  { value: "DRAZBA", label: "Dražby" },
  { value: "EXEKUCE", label: "Exekuce" },
  { value: "DEDICTVI", label: "Dědictví" },
  { value: "STAVEBNI_RIZENI", label: "Stavební" },
  { value: "JINE", label: "Jiné" },
];

export default function DeskaPage() {
  const [documents, setDocuments] = useState<DeskaDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (showArchived) params.set("archived", "1");
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/deska/documents?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setDocuments(data.documents ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, showArchived, page]);

  function loadDocuments() {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (showArchived) params.set("archived", "1");
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/deska/documents?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setDocuments(data.documents ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {});
  }

  const handleArchive = async (id: string) => {
    await fetch(`/api/deska/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: true }),
    });
    await loadDocuments();
  };

  const handleCreateProperty = async (id: string) => {
    const res = await fetch("/api/deska/create-property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deskaDocumentId: id }),
    });
    if (res.ok) {
      await loadDocuments();
    }
  };

  const unreadCount = documents.filter((d) => !d.isRead && !d.isArchived).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Úřední deska</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Monitorování úředních desek obcí ČR · {total} dokumentů
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                {unreadCount} nových
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              showSearch
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300",
            )}
          >
            Vyhledat na desce
          </button>
          <button
            onClick={() => loadDocuments()}
            className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
            title="Obnovit"
          >
            <ArrowClockwise className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="mb-6">
          <DeskaSearch onSelect={() => loadDocuments()} />
        </div>
      )}

      <div className="flex gap-6">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Funnel className="h-4 w-4 text-zinc-600" />
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setCategory(c.value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                  category === c.value
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {c.label}
              </button>
            ))}
            <div className="ml-auto">
              <button
                onClick={() => {
                  setShowArchived(!showArchived);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                  showArchived
                    ? "bg-zinc-800 text-zinc-300"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <Archive className="h-3.5 w-3.5" />
                Archiv
              </button>
            </div>
          </div>

          {/* Document list */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
                />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <p className="text-sm text-zinc-500">
                {showArchived
                  ? "Žádné archivované dokumenty."
                  : "Žádné dokumenty. Vytvořte sledování a spusťte polling."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <DeskaCard
                  key={doc.id}
                  doc={doc}
                  onArchive={handleArchive}
                  onCreateProperty={handleCreateProperty}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-700 disabled:opacity-50"
              >
                Předchozí
              </button>
              <span className="text-xs text-zinc-600">
                Strana {page} / {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / limit)}
                className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-700 disabled:opacity-50"
              >
                Další
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden w-72 shrink-0 lg:block">
          <WatchManager />
        </div>
      </div>
    </div>
  );
}
