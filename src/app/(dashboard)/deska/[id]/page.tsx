"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  Plus,
  Archive,
  NotePencil,
} from "@phosphor-icons/react";
import { CategoryBadge, RelevanceBadge } from "@/components/deska/category-badge";

interface DeskaDocDetail {
  id: string;
  edeskyId: string;
  name: string;
  dashboardName: string | null;
  dashboardId: string | null;
  category: string;
  relevance: string;
  keywordsMatched: string | null;
  origUrl: string | null;
  edeskyUrl: string | null;
  textContent: string | null;
  createdAtDeska: string | null;
  scrapedAt: number;
  isRead: number;
  isArchived: number;
  address: string | null;
  propertyId: string | null;
  leadId: string | null;
  notes: string | null;
  rawData: string | null;
}

export default function DeskaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [doc, setDoc] = useState<DeskaDocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/deska/documents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDoc(data);
        setNotes(data.notes ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveNotes = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await fetch(`/api/deska/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProperty = async () => {
    if (!doc || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/deska/create-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskaDocumentId: doc.id }),
      });
      if (res.ok) {
        router.push(`/leads`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async () => {
    if (!doc) return;
    await fetch(`/api/deska/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: true }),
    });
    router.push("/deska");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-zinc-800" />
          <div className="h-64 rounded-xl border border-zinc-800 bg-zinc-900/50" />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 text-center">
        <p className="text-zinc-500">Dokument nenalezen.</p>
      </div>
    );
  }

  const raw = safeParseRaw(doc.rawData);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/deska")}
        className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět na přehled
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CategoryBadge category={doc.category} />
          <RelevanceBadge relevance={doc.relevance} />
          {doc.propertyId && (
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
              V pipeline
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-zinc-100">{doc.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">{doc.dashboardName}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!doc.propertyId && (
              <button
                onClick={handleCreateProperty}
                disabled={creating}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Vytvářím..." : "Přidat do Pipeline"}
              </button>
            )}
            {doc.edeskyUrl && (
              <a
                href={doc.edeskyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              >
                <ArrowSquareOut className="h-4 w-4" />
                Otevřít na edesky.cz
              </a>
            )}
            {doc.origUrl && (
              <a
                href={doc.origUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              >
                <ArrowSquareOut className="h-4 w-4" />
                Zdrojový dokument
              </a>
            )}
            <button
              onClick={handleArchive}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
            >
              <Archive className="h-4 w-4" />
              Archivovat
            </button>
          </div>

          {/* Text content */}
          {doc.textContent && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-zinc-300">
                Obsah dokumentu (OCR)
              </h3>
              <pre className="whitespace-pre-wrap text-sm text-zinc-400">
                {doc.textContent}
              </pre>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
              <NotePencil className="h-4 w-4" />
              Poznámky
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Přidejte poznámky..."
              rows={4}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="mt-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Ukládám..." : "Uložit"}
            </button>
          </div>
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-300">Metadata</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-zinc-600">Obec / Úřad</dt>
                <dd className="text-zinc-300">{doc.dashboardName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-600">Datum na desce</dt>
                <dd className="text-zinc-300">
                  {formatDate(doc.createdAtDeska) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-600">Staženo</dt>
                <dd className="text-zinc-300">
                  {new Date(doc.scrapedAt).toLocaleDateString("cs-CZ")}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-600">edesky.cz ID</dt>
                <dd className="font-mono text-xs text-zinc-400">
                  {doc.edeskyId}
                </dd>
              </div>
              {doc.keywordsMatched && (
                <div>
                  <dt className="text-zinc-600">Klíčová slova</dt>
                  <dd className="text-zinc-300">{doc.keywordsMatched}</dd>
                </div>
              )}
              {doc.address && (
                <div>
                  <dt className="text-zinc-600">Adresa</dt>
                  <dd className="text-zinc-300">{doc.address}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Raw JSON viewer */}
          {raw != null && (
            <details className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <summary className="cursor-pointer text-sm font-medium text-zinc-500">
                Surová data (JSON)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto text-xs text-zinc-500">
                {JSON.stringify(raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(" +0100", "+01:00").replace(" +0200", "+02:00"));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeParseRaw(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
