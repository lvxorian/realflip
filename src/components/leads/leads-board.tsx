"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { WarningCircle, Kanban } from "@phosphor-icons/react";
import { LEAD_STAGES } from "@/lib/leads";
import { formatCompactPrice } from "@/lib/utils";
import { toast } from "sonner";
import { LeadCard } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { LeadsToolbar, INITIAL_LEAD_FILTERS, type LeadFilterState } from "./leads-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import type { LeadItem } from "./types";

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {LEAD_STAGES.map((s) => (
        <div key={s.key} className="flex w-[300px] shrink-0 flex-col gap-2">
          <div className="h-6 w-24 rounded-lg bg-border/20 animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-border/10 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LeadsBoard() {
  const [leads, setLeads] = useState<LeadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadFilterState>(INITIAL_LEAD_FILTERS);
  const [activeLead, setActiveLead] = useState<LeadItem | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const wasDragging = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: LeadItem[]) => {
        if (!cancelled) setLeads(data);
      })
      .catch(() => {
        if (!cancelled) setError("Nepodařilo se načíst pipeline.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!leads) return [];
    const q = filters.query.toLowerCase().trim();
    let result = leads.filter((l) => {
      if (q) {
        const haystack = [
          l.propertyTitle,
          l.propertyAddress,
          l.contactName,
          l.contactPhone,
          l.contactEmail,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.portal && l.propertyPortalName !== filters.portal) return false;
      if (filters.condition && l.propertyCondition !== filters.condition) return false;
      if (filters.priority && (l.priority ?? 0) < parseInt(filters.priority, 10)) return false;
      return true;
    });

    switch (filters.sort) {
      case "price-desc":
        result = [...result].sort((a, b) => (b.propertyPrice ?? 0) - (a.propertyPrice ?? 0));
        break;
      case "price-asc":
        result = [...result].sort((a, b) => (a.propertyPrice ?? 0) - (b.propertyPrice ?? 0));
        break;
      case "score-desc":
        result = [...result].sort((a, b) => (b.analysisScore ?? 0) - (a.analysisScore ?? 0));
        break;
      default:
        result = [...result].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    }
    return result;
  }, [leads, filters]);

  const byStage = useMemo(() => {
    const map = new Map<string, LeadItem[]>();
    LEAD_STAGES.forEach((s) => map.set(s.key, []));
    filtered.forEach((l) => {
      const list = map.get(l.stage);
      if (list) list.push(l);
    });
    return map;
  }, [filtered]);

  const maxCount = Math.max(...LEAD_STAGES.map((s) => byStage.get(s.key)?.length ?? 0), 1);

  const onLeadUpdated = useCallback((updated: LeadItem) => {
    setLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)) : prev));
  }, []);

  const moveLead = useCallback((id: string, fromStage: string, toStage: string, overId: string | null) => {
    setLeads((prev) => {
      if (!prev) return prev;
      const from = prev.filter((l) => l.stage === fromStage && l.id !== id);
      const lead = prev.find((l) => l.id === id);
      if (!lead) return prev;
      const updatedLead = { ...lead, stage: toStage, updatedAt: Date.now() };
      let result: LeadItem[];
      if (overId && overId !== id) {
        const to = prev.filter((l) => l.stage === toStage && l.id !== id);
        const overIndex = to.findIndex((l) => l.id === overId);
        if (overIndex >= 0) to.splice(overIndex, 0, updatedLead);
        else to.push(updatedLead);
        result = [...prev.filter((l) => l.stage !== fromStage && l.stage !== toStage), ...from, ...to];
      } else {
        result = [...prev.filter((l) => l.stage !== fromStage && l.stage !== toStage), ...from, updatedLead];
      }
      return result;
    });
  }, []);

  function handleDragStart(event: DragStartEvent) {
    wasDragging.current = true;
    const lead = leads?.find((l) => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);
    setTimeout(() => (wasDragging.current = false), 50);

    if (!over) return;
    const lead = leads?.find((l) => l.id === active.id);
    if (!lead) return;

    const overLead = leads?.find((l) => l.id === over.id);
    const toStage = overLead ? overLead.stage : over.id.toString();
    if (toStage === lead.stage) {
      if (overLead && overLead.id !== lead.id) {
        const stageList = filtered.filter((l) => l.stage === toStage);
        const fromIndex = stageList.findIndex((l) => l.id === lead.id);
        const toIndex = stageList.findIndex((l) => l.id === overLead.id);
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
          const reordered = arrayMove(stageList, fromIndex, toIndex);
          setLeads((prev) => {
            if (!prev) return prev;
            const rest = prev.filter((l) => l.stage !== toStage);
            return [...rest, ...reordered];
          });
        }
      }
      return;
    }

    const previousStage = lead.stage;
    moveLead(lead.id, previousStage, toStage, overLead ? overLead.id : null);

    fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: toStage }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch(() => {
        moveLead(lead.id, toStage, previousStage, null);
        toast.error("Přesun selhal — zkuste znovu");
      });
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">
        <div className="flex items-center gap-2 font-medium">
          <WarningCircle size={18} /> {error}
        </div>
        <button onClick={() => window.location.reload()} className="mt-3 text-xs text-red-400/80 underline">
          Načíst znovu
        </button>
      </div>
    );
  }

  if (leads === null) {
    return (
      <div className="space-y-4">
        <div className="h-[76px] rounded-2xl border border-border/50 bg-card animate-pulse" />
        <BoardSkeleton />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<Kanban size={22} weight="duotone" />}
        title="Pipeline je prázdná"
        description="Přidejte lead z detailu nemovitosti (tlačítko „Přidat do pipeline“) a začněte řídit nákupní proces."
      />
    );
  }

  return (
    <div className="space-y-4">
      <LeadsToolbar leads={leads} visible={filtered.length} filters={filters} onChange={setFilters} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {LEAD_STAGES.map((stage) => {
            const items = byStage.get(stage.key) ?? [];
            const sum = items.reduce((acc, l) => acc + (l.propertyPrice ?? 0), 0);
            const pct = items.length > 0 ? Math.round((items.length / maxCount) * 100) : 0;

            return (
              <div key={stage.key} className="flex w-[300px] shrink-0 flex-col snap-start">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${stage.dot} shadow-sm`} />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">{stage.label}</h2>
                  <span className="ml-auto rounded-md bg-border/20 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                    {items.length}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border/15 mb-3 overflow-hidden">
                  <div className={`h-full rounded-full ${stage.dot} transition-all duration-300`} style={{ width: `${pct}%` }} />
                </div>
                {sum > 0 && (
                  <div className="mb-2 px-1 text-[10px] font-mono text-muted/60">{formatCompactPrice(sum)} celkem</div>
                )}
                <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2.5 min-h-20">
                    {items.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onOpen={(l) => {
                          if (!wasDragging.current) setSelectedLead(l);
                        }}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/40 px-3 py-4 text-center text-[10px] text-muted/40">
                        Přetáhněte sem lead
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="w-[300px] rotate-2 shadow-2xl shadow-black/40">
              <LeadCard lead={activeLead} compact onOpen={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={onLeadUpdated}
        onConverted={(id) => setLeads((prev) => (prev ? prev.filter((l) => l.id !== id) : prev))}
      />
    </div>
  );
}
