"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, Scales } from "@phosphor-icons/react";
import { ScoreBadge } from "@/components/isir/score-badge";
import { SectionBadge } from "@/components/isir/section-badge";
import { cn, formatDate, formatRelative, safeJsonParse, investmentScoreColor } from "@/lib/utils";
import type { InsolvencyEvent } from "@/lib/isir/types";

const STATUS_OPTIONS = [
  { value: "new", label: "Nový" },
  { value: "contacted", label: "Kontaktován" },
  { value: "offer_sent", label: "Nabídka" },
  { value: "closed", label: "Uzavřeno" },
  { value: "lost", label: "Prohráno" },
];

export default function InsolvencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<InsolvencyEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/isir/documents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setEvent(data);
        setNotes(data.notesUser ?? "");
        setStatus(data.status ?? "new");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!event) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/isir/documents/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notesUser: notes }),
      });
      const updated = await res.json();
      setEvent(updated);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-800" />
          <div className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 text-center">
        <p className="text-sm text-zinc-500">Insolvence nenalezena</p>
        <Link href="/isir" className="mt-2 text-sm text-emerald-400 hover:underline">
          Zpět na přehled
        </Link>
      </div>
    );
  }

  const apartment = safeJsonParse<{
    address: string | null;
    disposition: string | null;
    area: number | null;
    cadastralArea: string | null;
    lvNumber: string | null;
    estimatedPrice: number | null;
    rawText: string;
  }>(event.apartmentData, {});

  const isirUrl = `https://isir.justice.cz/isir/verejle/${event.spisovaZnacka.replace(/\s+/g, "-")}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/isir"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět na přehled
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ScoreBadge score={event.score} />
            <SectionBadge section={event.section} />
            <span className="text-xs text-zinc-500">{event.notes}</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100">{event.spisovaZnacka}</h1>
          {event.court && <p className="mt-1 text-sm text-zinc-500">{event.court}</p>}
        </div>
        <a
          href={isirUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          <Scales className="h-3.5 w-3.5" />
          ISIR
        </a>
      </div>

      {/* Apartment Info */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Byt</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-500">Dispozice:</span>
            <span className="ml-2 text-zinc-100">{apartment.disposition ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Plocha:</span>
            <span className="ml-2 text-zinc-100">{apartment.area ? `${apartment.area} m²` : "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Adresa:</span>
            <span className="ml-2 text-zinc-100">{apartment.address ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Katastr:</span>
            <span className="ml-2 text-zinc-100">{apartment.cadastralArea ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">LV č.:</span>
            <span className="ml-2 text-zinc-100">{apartment.lvNumber ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Odhad:</span>
            <span className={cn("ml-2 font-medium", apartment.estimatedPrice ? "text-emerald-400" : "text-zinc-100")}>
              {apartment.estimatedPrice
                ? new Intl.NumberFormat("cs-CZ").format(apartment.estimatedPrice) + " Kč"
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Proceeding Info */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Řízení</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-500">Událost:</span>
            <span className="ml-2 text-zinc-100">{event.eventDesc ?? event.eventType}</span>
          </div>
          <div>
            <span className="text-zinc-500">Sekce:</span>
            <span className="ml-2 text-zinc-100">{event.section} / {event.sectionOrder}</span>
          </div>
          <div>
            <span className="text-zinc-500">Datum:</span>
            <span className="ml-2 text-zinc-100">{formatDate(event.publishedAt)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Stav:</span>
            <span className="ml-2 text-zinc-100">{event.notes ?? "—"}</span>
          </div>
        </div>
        {event.documentUrl && (
          <a
            href={event.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
          >
            <ArrowSquareOut className="h-3.5 w-3.5" />
            Otevřít dokument
          </a>
        )}
      </div>

      {/* Notes + Status */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Poznámky a stav</h2>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-zinc-500">Stav</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-zinc-500">Poznámka</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="Poznámka ke kontaktu se správcem..."
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Ukládám..." : "Uložit"}
        </button>
      </div>
    </div>
  );
}
