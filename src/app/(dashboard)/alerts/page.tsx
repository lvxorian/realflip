"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { StatusDot } from "@/components/ui/status-dot";
import { ToggleLeft, ToggleRight, Trash, Plus, Bell } from "@phosphor-icons/react";

const initialAlerts = [
  { id: "a1", name: "Praha – nové inzeráty", conditions: "Lokalita: Praha", active: true, lastTriggered: "před 2 h" },
  { id: "a2", name: "Podhodnocené > 20 %", conditions: "Skóre: 80+", active: true, lastTriggered: "před 5 h" },
  { id: "a3", name: "Cenový drop > 10 %", conditions: "Snížení ceny: >10%", active: false, lastTriggered: "před 2 d" },
  { id: "a4", name: "Brno – byty 3+kk", conditions: "Lokalita: Brno, Typ: Byt", active: true, lastTriggered: "před 1 d" },
];

const presets = [
  { label: "Lokalita", desc: "Hlídá nové inzeráty ve vybrané lokalitě" },
  { label: "Cena", desc: "Upozorní na cenu pod zvolenou hranicí" },
  { label: "Skóre", desc: "Alert na investiční skóre nad 80" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(initialAlerts);

  function toggle(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  }

  function remove(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const activeCount = alerts.filter((a) => a.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerty</h1>
          <p className="text-sm text-muted mt-1">{activeCount} aktivních alertů</p>
        </div>
        <StatusDot status={activeCount > 0 ? "active" : "idle"} />
      </div>

      {/* Active alerts */}
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center justify-between rounded-2xl border bg-card p-5 transition-all ${
              a.active ? "border-border/50" : "border-border/20 opacity-50"
            }`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                a.active ? "bg-accent/10 text-accent" : "bg-card text-muted"
              }`}>
                <Bell size={16} weight={a.active ? "fill" : "regular"} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted">{a.conditions}</p>
                  {a.active && <StatusDot status="active" />}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] text-muted hidden sm:block">{a.lastTriggered}</span>
              <button
                onClick={() => toggle(a.id)}
                className="text-muted hover:text-accent transition-colors"
              >
                {a.active ? <ToggleRight size={18} weight="fill" className="text-accent" /> : <ToggleLeft size={18} weight="fill" />}
              </button>
              <button
                onClick={() => remove(a.id)}
                className="text-muted hover:text-danger transition-colors"
              >
                <Trash size={14} weight="bold" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick create */}
      <div>
        <h2 className="font-semibold tracking-tight mb-4">Rychlé vytvoření</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {presets.map((p, i) => (
            <motion.button
              key={p.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card p-5 text-left hover:bg-card-hover hover:border-accent/30 transition-all group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
                <Plus size={16} weight="bold" />
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
