"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Plus,
  Trash,
  PencilSimple,
  Check,
  X,
  CheckSquare,
  Flag,
  CalendarBlank,
  ClipboardText,
} from "@phosphor-icons/react";
import { cn, formatDate } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueAt: number | null;
  priority: string;
  done: number;
  createdAt: number;
  updatedAt: number;
}

type Priority = "low" | "medium" | "high";
type Filter = "all" | "active" | "done";

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  medium: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  high: "text-red-400 border-red-500/20 bg-red-500/10",
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Vše" },
  { key: "active", label: "Aktivní" },
  { key: "done", label: "Hotové" },
];

export default function TasksPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTs] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    description: "",
    dueAt: "",
    priority: "medium" as Priority,
  });
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    dueAt: "",
    priority: "medium" as Priority,
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d: Task[]) => {
        setTasks(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function dateToEpoch(value: string): number | null {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  function epochToDate(value: number | null): string {
    if (!value) return "";
    const d = new Date(value);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  async function create() {
    const title = draft.title.trim();
    if (!title) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: draft.description,
        dueAt: dateToEpoch(draft.dueAt),
        priority: draft.priority,
      }),
    });
    if (res.ok) {
      const created = (await res.json()) as Task;
      setTasks((prev) => [created, ...prev]);
      setDraft({ title: "", description: "", dueAt: "", priority: "medium" });
      toast.success("Úkol přidán");
    } else {
      toast.error("Nepodařilo se přidat úkol");
    }
  }

  async function toggle(task: Task) {
    const nextDone = task.done ? 0 : 1;
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: nextDone }),
    });
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: nextDone } : t))
    );
    if (nextDone) toast.success(`„${task.title}" dokončeno`);
  }

  async function remove(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("Úkol smazán");
    } else {
      toast.error("Nepodařilo se smazat úkol");
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditDraft({
      title: task.title,
      description: task.description ?? "",
      dueAt: epochToDate(task.dueAt),
      priority: (["low", "medium", "high"].includes(task.priority)
        ? task.priority
        : "medium") as Priority,
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const title = editDraft.title.trim();
    if (!title) return;
    const res = await fetch(`/api/tasks/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: editDraft.description,
        dueAt: dateToEpoch(editDraft.dueAt),
        priority: editDraft.priority,
      }),
    });
    if (res.ok) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                title,
                description: editDraft.description || null,
                dueAt: dateToEpoch(editDraft.dueAt),
                priority: editDraft.priority,
              }
            : t
        )
      );
      setEditingId(null);
      toast.success("Úkol uložen");
    } else {
      toast.error("Nepodařilo se uložit úkol");
    }
  }

  if (status !== "authenticated" || loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Úkoly</h1>
          <p className="text-sm text-muted mt-1">Načítání...</p>
        </div>
      </div>
    );
  }

  const openCount = tasks.filter((t) => !t.done).length;
  const filtered =
    filter === "active"
      ? tasks.filter((t) => !t.done)
      : filter === "done"
      ? tasks.filter((t) => t.done)
      : tasks;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Úkoly</h1>
          <p className="text-sm text-muted mt-1">
            {openCount > 0 ? `${openCount} otevřených úkolů` : "Vše hotovo"}
          </p>
        </div>
        <StatusDot status={openCount > 0 ? "active" : "idle"} />
      </div>

      {/* Add form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/50 bg-card p-5"
      >
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1">
            <Input
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="Co je potřeba udělat?"
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={draft.priority}
              onChange={(e) =>
                setDraft((p) => ({ ...p, priority: e.target.value as Priority }))
              }
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-accent/50"
            >
              {(["low", "medium", "high"] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  Priorita: {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={draft.dueAt}
              onChange={(e) => setDraft((p) => ({ ...p, dueAt: e.target.value }))}
              className="w-40"
              title="Termín"
            />
            <Button onClick={create} disabled={!draft.title.trim()}>
              <Plus size={16} weight="bold" /> Přidat
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <Input
            value={draft.description}
            onChange={(e) =>
              setDraft((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Poznámka (volitelná)"
            className="max-w-xl"
          />
        </div>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-accent/10 text-accent"
                : "text-muted hover:text-foreground bg-card border border-border/50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((task, i) => {
            const priority = (["low", "medium", "high"].includes(task.priority)
              ? task.priority
              : "medium") as Priority;
            const overdue = task.dueAt && !task.done && task.dueAt < nowTs;
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "rounded-2xl border bg-card p-4 transition-all",
                  task.done ? "border-border/20 opacity-60" : "border-border/50"
                )}
              >
                {editingId === task.id ? (
                  <div className="space-y-3">
                    <div className="flex flex-col lg:flex-row gap-2">
                      <Input
                        value={editDraft.title}
                        onChange={(e) =>
                          setEditDraft((p) => ({ ...p, title: e.target.value }))
                        }
                        className="flex-1"
                        placeholder="Název úkolu"
                      />
                      <select
                        value={editDraft.priority}
                        onChange={(e) =>
                          setEditDraft((p) => ({
                            ...p,
                            priority: e.target.value as Priority,
                          }))
                        }
                        className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-accent/50"
                      >
                        {(["low", "medium", "high"] as Priority[]).map((p) => (
                          <option key={p} value={p}>
                            {PRIORITY_LABELS[p]}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="date"
                        value={editDraft.dueAt}
                        onChange={(e) =>
                          setEditDraft((p) => ({ ...p, dueAt: e.target.value }))
                        }
                        className="w-40"
                      />
                    </div>
                    <Input
                      value={editDraft.description}
                      onChange={(e) =>
                        setEditDraft((p) => ({ ...p, description: e.target.value }))
                      }
                      placeholder="Poznámka"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={!editDraft.title.trim()}
                      >
                        <Check size={12} weight="bold" /> Uložit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X size={12} weight="bold" /> Zrušit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => toggle(task)}
                        className="mt-0.5 shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-card-hover transition-colors"
                        title={task.done ? "Označit jako nedokončené" : "Dokončit"}
                      >
                        <CheckSquare
                          size={22}
                          weight={task.done ? "fill" : "regular"}
                          className={task.done ? "text-accent" : ""}
                        />
                      </button>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium break-words",
                            task.done && "line-through text-muted"
                          )}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-muted mt-0.5 break-words">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                              PRIORITY_STYLES[priority]
                            )}
                          >
                            <Flag size={10} weight="fill" />
                            {PRIORITY_LABELS[priority]}
                          </span>
                          {task.dueAt && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                                overdue
                                  ? "text-red-400 border-red-500/20 bg-red-500/10"
                                  : "text-muted border-border/50 bg-card"
                              )}
                            >
                              <CalendarBlank size={10} weight="fill" />
                              {formatDate(task.dueAt)}
                              {overdue ? " — po termínu" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(task)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-card-hover transition-colors"
                        title="Upravit"
                      >
                        <PencilSimple size={15} weight="bold" />
                      </button>
                      <button
                        onClick={() => remove(task)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Smazat"
                      >
                        <Trash size={15} weight="bold" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card p-8">
          <EmptyState
            icon={<ClipboardText size={24} weight="duotone" />}
            title={tasks.length > 0 ? "Žádné úkoly" : "Zatím žádné úkoly"}
            description={
              tasks.length > 0
                ? "V tomto filtru nic není."
                : "Přidejte první úkol pomocí formuláře výše."
            }
          />
        </div>
      )}
    </div>
  );
}