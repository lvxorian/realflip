"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StatusDot } from "@/components/ui/status-dot";
import { ToggleLeft, ToggleRight, Trash, Bell, Plus, PencilSimple, MapPin, CurrencyDollar, Star, Check, X } from "@phosphor-icons/react";

interface Alert {
  id: string;
  name: string;
  conditions: string | null;
  rules: string;
  isActive: number | null;
  lastTriggered: number | null;
}

const presets = [
  { label: "Cenový drop", desc: "Upozorní na snížení ceny o více než 10 %", icon: CurrencyDollar, name: "Cenový drop > 10 %", conditions: "Snížení ceny: >10%", rules: { type: "price_drop", minDropPct: 10 } },
  { label: "Skóre", desc: "Alert na investiční skóre nad 80", icon: Star, name: "Podhodnocené nemovitosti", conditions: "Skóre: 80+", rules: { type: "score_threshold", minScore: 80 } },
  { label: "Lokalita", desc: "Hlídá nové inzeráty ve vybrané lokalitě", icon: MapPin, name: "Nové inzeráty v lokalitě", conditions: "Lokalita: Praha", rules: { type: "price_drop", minDropPct: 5 } },
];

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", conditions: "" });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d: Alert[]) => { setAlerts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggle(id: string) {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: alert.isActive ? 0 : 1 }),
    });
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isActive: a.isActive ? 0 : 1 } : a));
  }

  async function remove(id: string) {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function create(preset: typeof presets[0]) {
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: preset.name, conditions: preset.conditions, rules: preset.rules }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlerts((prev) => [...prev, { id: data.id, name: preset.name, conditions: preset.conditions, rules: JSON.stringify(preset.rules), isActive: 1, lastTriggered: null }]);
    }
  }

  function startEdit(alert: Alert) {
    setEditingId(alert.id);
    setEditDraft({ name: alert.name, conditions: alert.conditions ?? "" });
  }

  async function saveEdit() {
    if (!editingId) return;
    await fetch(`/api/alerts/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editDraft),
    });
    setAlerts((prev) => prev.map((a) => a.id === editingId ? { ...a, name: editDraft.name, conditions: editDraft.conditions } : a));
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  if (status !== "authenticated" || loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Alerty</h1>
            <p className="text-sm text-muted mt-1">Načítání...</p>
          </div>
        </div>
      </div>
    );
  }

  const activeCount = alerts.filter((a) => a.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerty</h1>
          <p className="text-sm text-muted mt-1">{activeCount} aktivních alertů</p>
        </div>
        <StatusDot status={activeCount > 0 ? "active" : "idle"} />
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-2xl border bg-card p-5 transition-all ${
                a.isActive ? "border-border/50" : "border-border/20 opacity-50"
              }`}
            >
              {editingId === a.id ? (
                <div className="space-y-3">
                  <input
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm font-medium outline-none focus:border-accent/50"
                    placeholder="Název alertu"
                  />
                  <input
                    value={editDraft.conditions}
                    onChange={(e) => setEditDraft((p) => ({ ...p, conditions: e.target.value }))}
                    className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-xs text-muted outline-none focus:border-accent/50"
                    placeholder="Podmínky"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={saveEdit} className="flex items-center gap-1 rounded-lg bg-accent/10 text-accent px-3 py-1.5 text-xs font-medium hover:bg-accent/20 transition-colors">
                      <Check size={12} weight="bold" /> Uložit
                    </button>
                    <button onClick={cancelEdit} className="flex items-center gap-1 rounded-lg bg-card text-muted px-3 py-1.5 text-xs hover:text-foreground transition-colors">
                      <X size={12} weight="bold" /> Zrušit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      a.isActive ? "bg-accent/10 text-accent" : "bg-card text-muted"
                    }`}>
                      <Bell size={16} weight={a.isActive ? "fill" : "regular"} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted">{a.conditions}</p>
                        {a.isActive ? <StatusDot status="active" /> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => startEdit(a)} className="text-muted hover:text-accent transition-colors">
                      <PencilSimple size={14} weight="bold" />
                    </button>
                    <button onClick={() => toggle(a.id)} className="text-muted hover:text-accent transition-colors">
                      {a.isActive ? <ToggleRight size={18} weight="fill" className="text-accent" /> : <ToggleLeft size={18} weight="fill" />}
                    </button>
                    <button onClick={() => remove(a.id)} className="text-muted hover:text-danger transition-colors">
                      <Trash size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
          <p className="text-sm text-muted">Zatím nemáte žádné alerty. Vytvořte si první alert pomocí šablon níže.</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold tracking-tight mb-4">Rychlé vytvoření</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {presets.map((p, i) => (
            <motion.button
              key={p.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              onClick={() => create(p)}
              className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card p-5 text-left hover:bg-card-hover hover:border-accent/30 transition-all group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
                <p.icon size={16} weight="bold" />
              </div>
              <div>
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted mt-0.5">{p.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
