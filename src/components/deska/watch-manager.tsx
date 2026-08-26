"use client";

import { useState, useEffect } from "react";
import { Plus, Power, Trash } from "@phosphor-icons/react";

interface Watch {
  id: string;
  name: string;
  keywords: string;
  category: string | null;
  dashboardIds: string;
  isActive: number;
  lastCheckedAt: number | null;
}

export function WatchManager() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWatches();
  }, []);

  function loadWatches() {
    fetch("/api/deska/watches")
      .then((r) => r.json())
      .then((data) => setWatches(data.watches ?? []))
      .catch(() => {});
  }

  const handleCreate = async () => {
    if (!name.trim() || !keywordsInput.trim()) return;
    setSaving(true);
    try {
      const keywords = keywordsInput
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch("/api/deska/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          keywords,
          category: category || null,
        }),
      });
      if (res.ok) {
        setName("");
        setKeywordsInput("");
        setCategory("");
        setShowForm(false);
        await loadWatches();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleWatch = async (watch: Watch) => {
    await fetch("/api/deska/watches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: watch.id, isActive: !watch.isActive }),
    });
    await loadWatches();
  };

  const deleteWatch = async (id: string) => {
    await fetch(`/api/deska/watches?id=${id}`, { method: "DELETE" });
    await loadWatches();
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Moje sledování</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Název (např. Praha - prodeje)"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="Klíčová slova (čárkou)"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="">Všechny kategorie</option>
            <option value="PRODEJ">Prodej</option>
            <option value="DRAZBA">Dražba</option>
            <option value="EXEKUCE">Exekuce</option>
            <option value="DEDICTVI">Dědictví</option>
            <option value="STAVEBNI_RIZENI">Stavební řízení</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim() || !keywordsInput.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Ukládám..." : "Uložit"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {watches.length === 0 && (
          <p className="text-xs text-zinc-600">Zatím žádná sledování.</p>
        )}
        {watches.map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-300">{w.name}</p>
              <p className="truncate text-xs text-zinc-600">
                {safeParseArr(w.keywords).join(", ")}
                {w.category ? ` · ${w.category}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleWatch(w)}
                className={`rounded p-1 ${w.isActive ? "text-emerald-400" : "text-zinc-600"} hover:bg-zinc-800`}
                title={w.isActive ? "Deaktivovat" : "Aktivovat"}
              >
                <Power className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => deleteWatch(w.id)}
                className="rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-red-400"
                title="Smazat"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function safeParseArr(json: unknown): string[] {
  if (Array.isArray(json)) return json;
  if (typeof json === "string") {
    try {
      const p = JSON.parse(json);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}
