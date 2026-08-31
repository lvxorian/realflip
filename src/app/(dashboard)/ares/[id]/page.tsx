"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react";
import { ScoreBadge } from "@/components/isir/score-badge";
import { LegalFormLabel } from "@/components/ares/company-card";
import { cn, formatDate, safeJsonParse } from "@/lib/utils";
import type { AresCompany, CatastrOwnership } from "@/lib/ares/types";

const PIPELINE_OPTIONS = [
  { value: "new", label: "Nový" },
  { value: "contacted", label: "Kontaktován" },
  { value: "offer_sent", label: "Nabídka" },
  { value: "closed", label: "Uzavřeno" },
  { value: "lost", label: "Prohráno" },
];

export default function AresDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<AresCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/ares/companies/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCompany(data);
        setNotes(data.notesUser ?? "");
        setPipeline(data.pipeline ?? "new");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!company) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ares/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline, notesUser: notes }),
      });
      const updated = await res.json();
      setCompany(updated);
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

  if (!company) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 text-center">
        <p className="text-sm text-zinc-500">Firma nenalezena</p>
        <Link href="/ares" className="mt-2 text-sm text-emerald-400 hover:underline">
          Zpět na přehled
        </Link>
      </div>
    );
  }

  const ownership = parseOwnership(company.propertyOwned);

  const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty/ico/${company.ico}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/ares"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět na přehled
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ScoreBadge score={company.score} />
            <span className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              company.status === "EXEKUCE"
                ? "bg-red-500/15 text-red-400 border-red-500/20"
                : "bg-amber-500/15 text-amber-400 border-amber-500/20"
            )}>
              {company.status === "EXEKUCE" ? "Exekuce" : "V likvidaci"}
            </span>
            {company.apartmentFound && (
              <span className="inline-flex items-center rounded-full border border-emerald-700 bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-300">
                Byt v majetku
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-zinc-100">{company.name ?? `IČO ${company.ico}`}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            IČO {company.ico}
            {company.legalForm ? ` · ${LegalFormLabel(company.legalForm)}` : ""}
          </p>
        </div>
        <a
          href={aresUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          <ArrowSquareOut className="h-3.5 w-3.5" />
          ARES
        </a>
      </div>

      {/* Firma */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Firma</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-500">Sídlo:</span>
            <span className="ml-2 text-zinc-100">{company.sidlo ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Právní forma:</span>
            <span className="ml-2 text-zinc-100">{LegalFormLabel(company.legalForm)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Soud / spis:</span>
            <span className="ml-2 text-zinc-100">{company.spisovaZnacka ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Likvidace od:</span>
            <span className="ml-2 text-zinc-100">
              {company.liquidationDate ? formatDate(company.liquidationDate) : "—"}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Exekuce:</span>
            <span className={cn("ml-2", company.hasExecution ? "text-red-400" : "text-zinc-100")}>
              {company.hasExecution ? "Ano" : "Ne"}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Poslední aktualizace ARES:</span>
            <span className="ml-2 text-zinc-100">
              {company.lastUpdatedAres ? formatDate(company.lastUpdatedAres) : "—"}
            </span>
          </div>
        </div>
        {company.reasoning && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-zinc-500">Důvod / stav v rejstříku</p>
            <p className="text-xs leading-relaxed text-zinc-300">{company.reasoning}</p>
          </div>
        )}
      </div>

      {/* Vlastnictví (katastr) */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Vlastnictví (katastr)</h2>
          <span className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium",
            ownership.verified
              ? "border-emerald-700 bg-emerald-900/30 text-emerald-300"
              : "border-zinc-700 bg-zinc-800 text-zinc-400"
          )}>
            {ownership.verified ? "Ověřeno" : "Neověřeno"}
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          {ownership.reason || "Majetek zatím nebyl ověřen (je potřeba WSDP účet ČÚZK)."}
        </p>

        {ownership.properties.length > 0 && (
          <div className="mt-3 space-y-1">
            {ownership.properties.slice(0, 20).map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/20 px-3 py-1.5 text-xs">
                <span className="text-zinc-300">
                  {p.typParcely === "STAVBA" ? "Stavba" : "Parcela"}
                  {p.parcelniCislo ? ` ${p.parcelniCislo}` : ""}
                </span>
                <span className="text-zinc-500">
                  k.ú. {p.katuzeKod} · LV {p.lvId}
                  {p.vymera ? ` · ${p.vymera} m²` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Poznámky a stav */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Poznámky a stav</h2>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-zinc-500">Stav</label>
          <select
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            {PIPELINE_OPTIONS.map((opt) => (
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
            placeholder="Poznámka ke kontaktu s likvidátorem..."
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

function parseOwnership(raw: string | null | undefined): CatastrOwnership {
  const fallback: CatastrOwnership = { verified: false, reason: "", totalLvs: 0, properties: [] };
  if (!raw) return fallback;
  // Already an object (PG jsonb) → return as-is; otherwise JSON string.
  try {
    if (typeof raw === "object" && raw !== null) return raw as unknown as CatastrOwnership;
  } catch {
    /* noop */
  }
  return safeJsonParse<CatastrOwnership>(raw, fallback);
}
