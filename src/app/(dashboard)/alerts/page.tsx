"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StatusDot } from "@/components/ui/status-dot";
import { ToggleLeft, ToggleRight, Trash, Bell, Plus } from "@phosphor-icons/react";

interface Alert {
  id: string;
  name: string;
  conditions: string | null;
  isActive: number | null;
  lastTriggered: number | null;
}

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

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
              className={`flex items-center justify-between rounded-2xl border bg-card p-5 transition-all ${
                a.isActive ? "border-border/50" : "border-border/20 opacity-50"
              }`}
            >
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
                <button
                  onClick={() => toggle(a.id)}
                  className="text-muted hover:text-accent transition-colors"
                >
                  {a.isActive ? <ToggleRight size={18} weight="fill" className="text-accent" /> : <ToggleLeft size={18} weight="fill" />}
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
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
          <p className="text-sm text-muted">Zatím nemáte žádné alerty.</p>
        </div>
      )}
    </div>
  );
}
