"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  closestCorners,
  MeasuringStrategy,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { WarningCircle, Kanban, TrendUp, Clock } from "@phosphor-icons/react";
import { LEAD_STAGES, LEAD_STAGE_KEYS, resolveDropTarget, leadExpectedValue, leadExpectedProfit, timeInStageDays } from "@/lib/leads";
import { moveLeadToStage, reorderLeadInStage } from "@/lib/pipeline-board";
import { formatCompactPrice, cn } from "@/lib/utils";
import { currentTime } from "@/lib/clock";
import { toast } from "sonner";
import { LeadCard, LeadCardView } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { StageTransitionModal, type StageAction } from "./stage-transition-modal";
import { LeadsToolbar, INITIAL_LEAD_FILTERS, type LeadFilterState } from "./leads-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import type { LeadItem } from "./types";

const isStageId = (id: unknown): id is string => typeof id === "string" && LEAD_STAGE_KEYS.has(id);

// Kolizní detekce boardu:
// 1) karta pod pointerem → pointerWithin na kartách (precizní vložení mezi karty)
// 2) jinak sloupec pod pointerem → pointerWithin na sloupcích (funguje i pro PRÁZDNÝ
//    sloupec — dnd-kit issue #668/#432: closestCorners prázdný droppable nikdy nevrátí)
// 3) fallback → closestCorners (nejbližší karta/sloupec, např. při upuštění do mezery)
// Aktivní (přetahovaná) karta je z kandidátů vyloučena, aby se nestala vlastním cílem.
const boardCollision: CollisionDetection = (args) => {
  const candidates = args.droppableContainers.filter((c) => c.id !== args.active.id && !c.disabled);
  const cards = candidates.filter((c) => !isStageId(c.id));
  const cols = candidates.filter((c) => isStageId(c.id));

  let hits = pointerWithin({ ...args, droppableContainers: cards });
  if (hits.length > 0) return hits;

  hits = pointerWithin({ ...args, droppableContainers: cols });
  if (hits.length > 0) return hits;

  hits = closestCorners({ ...args, droppableContainers: cards });
  if (hits.length > 0) return hits;

  return closestCorners({ ...args, droppableContainers: cols });
};

function InsertionLine() {
  return <div className="h-1.5 rounded-lg border-2 border-dashed border-accent/60 bg-accent/5 animate-pulse" />;
}

function StageColumn({
  stageKey,
  highlighted,
  children,
}: {
  stageKey: string;
  highlighted: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey, data: { stage: stageKey } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[170px] max-w-[360px] flex-1 basis-0 flex-col snap-start @container rounded-xl transition-all",
        (isOver || highlighted) && "bg-accent/5 ring-1 ring-accent/30"
      )}
    >
      {children}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-4 snap-x">
      {LEAD_STAGES.map((s) => (
        <div key={s.key} className="flex min-w-[170px] flex-1 basis-0 flex-col gap-2 snap-start">
          <div className="h-6 w-24 rounded-lg bg-border/20 animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-border/10 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function patchLead(id: string, body: Record<string, unknown>): Promise<boolean> {
  return fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((res) => (res.ok ? true : Promise.reject(new Error(`HTTP ${res.status}`))))
    .catch(() => false);
}

interface DragTarget {
  id: string;
  kind: "card" | "column";
}

interface PendingMove {
  kind: StageAction;
  lead: LeadItem;
  toStage: string;
  overLeadId: string | null;
}

export function LeadsBoard() {
  const [leads, setLeads] = useState<LeadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadFilterState>(INITIAL_LEAD_FILTERS);
  const [activeLead, setActiveLead] = useState<LeadItem | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [openSeq, setOpenSeq] = useState(0);
  const [latestOver, setLatestOver] = useState<DragTarget | null>(null);
  const wasDragging = useRef(false);
  const requestSeq = useRef(0);
  const leadsRef = useRef<LeadItem[] | null>(null);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

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
      if (filters.stage && l.stage !== filters.stage) return false;
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
        result = [...result].sort((a, b) => {
          const byPos = (a.position ?? 0) - (b.position ?? 0);
          if (byPos !== 0) return byPos;
          return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        });
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

  const totals = useMemo(() => {
    if (!leads) return { count: 0, expectedValue: 0, expectedProfit: 0 };
    let expectedValue = 0;
    let expectedProfit = 0;
    for (const l of leads) {
      expectedValue += leadExpectedValue(l);
      expectedProfit += leadExpectedProfit(l);
    }
    return { count: leads.length, expectedValue, expectedProfit };
  }, [leads]);

  const onLeadUpdated = useCallback((updated: LeadItem) => {
    setLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)) : prev));
  }, []);

  const handlePriorityToggle = useCallback((lead: LeadItem) => {
    const cycle = [0, 1, 2, 3];
    const next = cycle[(cycle.indexOf(lead.priority ?? 0) + 1) % cycle.length];
    onLeadUpdated({ ...lead, priority: next });
    void patchLead(lead.id, { priority: next }).then((ok) => {
      if (!ok) {
        onLeadUpdated({ ...lead, priority: lead.priority });
        toast.error("Změna priority se neuložila");
      }
    });
  }, [onLeadUpdated]);

  /**
   * Optimistický přesun leadu do cílové fáze. Vrací Promise<boolean> — true = uloženo.
   * Při selhání vrátí stav do podoby před přesunem (moveLeadToStage + positionOverride).
   */
  function executeMove(
    leadId: string,
    toStage: string,
    overLeadId: string | null,
    opts?: { lostReason?: string | null; suppressToast?: boolean }
  ): Promise<boolean> {
    const base = leadsRef.current ?? leads;
    if (!base) return Promise.resolve(false);
    const lead = base.find((l) => l.id === leadId);
    if (!lead) return Promise.resolve(false);

    const previousStage = lead.stage;
    const previousPosition = lead.position;
    const moved = moveLeadToStage(base, leadId, toStage, overLeadId);
    if (!moved) return Promise.resolve(false);

    setLeads(moved.leads);
    const requestId = ++requestSeq.current;

    const body: Record<string, unknown> = { stage: toStage, position: moved.newPos };
    if (opts?.lostReason != null) body.lostReason = opts.lostReason;
    // Vrácení ztraceného leadu zpět vynuluje uložený důvod ztráty
    if (previousStage === "lost" && toStage !== "lost") body.lostReason = null;

    return patchLead(leadId, body).then((ok) => {
      if (requestId !== requestSeq.current) return ok;
      if (!ok) {
        const reverted = moveLeadToStage(base, leadId, previousStage, null, previousPosition ?? 0);
        setLeads(reverted?.leads ?? base);
        toast.error("Přesun selhal — vráceno zpět");
        return false;
      }
      if (!opts?.suppressToast) {
        const stageLabel = LEAD_STAGES.find((s) => s.key === toStage)?.label ?? toStage;
        toast.success(`Přesunuto do „${stageLabel}"`, {
          action: {
            label: "Zpět",
            onClick: () => {
              const undoBase = leadsRef.current ?? moved.leads;
              const reverted = moveLeadToStage(undoBase, leadId, previousStage, null, previousPosition ?? 0);
              if (!reverted) return;
              setLeads(reverted.leads);
              void patchLead(leadId, { stage: previousStage, position: previousPosition ?? 0 });
            },
          },
        });
      }
      return true;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    wasDragging.current = true;
    const lead = leads?.find((l) => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over || typeof over.id !== "string") {
      setLatestOver(null);
      return;
    }
    setLatestOver(isStageId(over.id) ? { id: over.id, kind: "column" } : { id: over.id, kind: "card" });
  }

  function handleDragCancel() {
    setActiveLead(null);
    setLatestOver(null);
    setTimeout(() => (wasDragging.current = false), 50);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);
    setLatestOver(null);
    setTimeout(() => (wasDragging.current = false), 50);

    if (!over || !leads) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;

    const toStage = resolveDropTarget(over.id, over.data.current, leads);
    if (!toStage) return;

    const overLead =
      typeof over.id === "string" && over.id !== lead.id ? (leads.find((l) => l.id === over.id) ?? null) : null;

    // Přerovnání uvnitř stejné fáze
    if (toStage === lead.stage) {
      if (overLead) {
        const snapshot = leads;
        const reordered = reorderLeadInStage(leads, lead.id, overLead.id);
        if (!reordered) return;
        setLeads(reordered.leads);
        const requestId = ++requestSeq.current;
        void patchLead(lead.id, { position: reordered.newPos }).then((ok) => {
          if (requestId !== requestSeq.current) return;
          if (!ok) {
            setLeads(snapshot);
            toast.error("Přesun selhal — vráceno zpět");
          }
        });
      }
      return;
    }

    // Terminální a zpětné přesuny jdou přes potvrzovací modal
    const fromTerminal = lead.stage === "closed" || lead.stage === "lost";
    if (toStage === "lost") {
      openPending({ kind: "lost", lead, toStage, overLeadId: overLead?.id ?? null });
    } else if (toStage === "closed") {
      openPending({ kind: "closed", lead, toStage, overLeadId: overLead?.id ?? null });
    } else if (fromTerminal) {
      openPending({ kind: "reopen", lead, toStage, overLeadId: overLead?.id ?? null });
    } else {
      void executeMove(lead.id, toStage, overLead?.id ?? null);
    }
  }

  /** Rychlá akce na kartě: posun o jednu fázi dál (terminální fáze → modal). */
  function handleQuickAdvance(lead: LeadItem) {
    const idx = LEAD_STAGES.findIndex((s) => s.key === lead.stage);
    if (idx < 0 || idx >= LEAD_STAGES.length - 1) return;
    const next = LEAD_STAGES[idx + 1].key;
    if (next === "lost") {
      openPending({ kind: "lost", lead, toStage: "lost", overLeadId: null });
    } else if (next === "closed") {
      openPending({ kind: "closed", lead, toStage: "closed", overLeadId: null });
    } else {
      void executeMove(lead.id, next, null);
    }
  }

  function handleMarkLost(lead: LeadItem) {
    openPending({ kind: "lost", lead, toStage: "lost", overLeadId: null });
  }

  function openPending(move: PendingMove) {
    setPending(move);
    setOpenSeq((s) => s + 1);
  }

  function closePending() {
    setPending(null);
  }

  function confirmLost(reason: string) {
    const p = pending;
    if (!p) return;
    setPending(null);
    void executeMove(p.lead.id, p.toStage, p.overLeadId, { lostReason: reason });
  }

  function confirmCloseOnly() {
    const p = pending;
    if (!p) return;
    setPending(null);
    void executeMove(p.lead.id, p.toStage, p.overLeadId);
  }

  async function confirmConvert(purchasePrice: number, renovationBudget: number | null, investorId: string | null) {
    const p = pending;
    if (!p) return;
    setPending(null);
    const moved = await executeMove(p.lead.id, "closed", p.overLeadId, { suppressToast: true });
    if (!moved) {
      toast.error("Přesun do Uzavřeno selhal — převod zrušen");
      return;
    }
    try {
      const res = await fetch(`/api/leads/${p.lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchasePrice, renovationBudget, investorId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Převod na deal selhal");
        return;
      }
      setLeads((prev) => (prev ? prev.filter((l) => l.id !== p.lead.id) : prev));
      toast.success("Lead převeden na deal");
    } catch {
      toast.error("Převod na deal selhal");
    }
  }

  function confirmReopen() {
    const p = pending;
    if (!p) return;
    setPending(null);
    void executeMove(p.lead.id, p.toStage, p.overLeadId);
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
        collisionDetection={boardCollision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-2.5 overflow-x-auto pb-4 snap-x">
          {LEAD_STAGES.map((stage) => {
            const items = byStage.get(stage.key) ?? [];
            const sum = items.reduce((acc, l) => acc + (l.propertyPrice ?? 0), 0);
            const expected = items.reduce((acc, l) => acc + leadExpectedValue(l), 0);
            const pct = items.length > 0 ? Math.round((items.length / maxCount) * 100) : 0;

            const now = currentTime();
            const active = items.filter((l) => l.stage !== "closed" && l.stage !== "lost");
            const avgDays =
              active.length > 0
                ? Math.round(active.reduce((acc, l) => acc + timeInStageDays(l.stageEnteredAt, now), 0) / active.length)
                : null;
            const overdueCount = active.filter(
              (l) => l.nextStepDueAt != null && l.nextStepDueAt > 0 && l.nextStepDueAt < now
            ).length;

            const highlighted = latestOver
              ? latestOver.kind === "column"
                ? latestOver.id === stage.key
                : items.some((l) => l.id === latestOver.id)
              : false;

            return (
              <StageColumn key={stage.key} stageKey={stage.key} highlighted={highlighted}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${stage.dot} shadow-sm shrink-0`} />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">{stage.label}</h2>
                  <span className="ml-auto shrink-0 rounded-md bg-border/20 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                    {items.length}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border/15 mb-3 overflow-hidden">
                  <div className={`h-full rounded-full ${stage.dot} transition-all duration-300`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mb-2 px-1 text-[10px] font-mono text-muted/60 @max-[240px]:hidden flex items-center justify-between gap-1">
                  {sum > 0 ? (
                    <span>{formatCompactPrice(sum)} celkem</span>
                  ) : (
                    <span>{"\u00A0"}</span>
                  )}
                  {expected > 0 && (
                    <span
                      className="text-emerald-400/80"
                      title={`Očekávaná hodnota (${Math.round(stage.probability * 100)} % pravděpodobnost fáze)`}
                    >
                      ≈{formatCompactPrice(expected)}
                    </span>
                  )}
                </div>
                {(avgDays != null || overdueCount > 0) && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1 @max-[240px]:hidden">
                    {avgDays != null && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-border/15 px-1.5 py-0.5 text-[10px] font-mono text-muted"
                        title="Průměrný čas leadů ve fázi"
                      >
                        <Clock size={9} weight="fill" /> Ø {avgDays} dní
                      </span>
                    )}
                    {overdueCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-mono text-red-400"
                        title="Leadů s propadlým dalším krokem"
                      >
                        {overdueCount} overdue
                      </span>
                    )}
                  </div>
                )}
                <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2.5 min-h-20">
                    {items.map((lead) => (
                      <Fragment key={lead.id}>
                        {latestOver?.kind === "card" && latestOver.id === lead.id && <InsertionLine />}
                        <LeadCard
                          lead={lead}
                          onOpen={(l) => {
                            if (!wasDragging.current) setSelectedLead(l);
                          }}
                          onTogglePriority={handlePriorityToggle}
                          onAdvance={handleQuickAdvance}
                          onMarkLost={handleMarkLost}
                        />
                      </Fragment>
                    ))}
                    {latestOver?.kind === "column" && latestOver.id === stage.key && items.length > 0 && <InsertionLine />}
                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/40 px-3 py-4 text-center text-[10px] text-muted/40">
                        Přetáhněte sem lead
                      </div>
                    )}
                  </div>
                </SortableContext>
              </StageColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="w-[280px] rotate-2 shadow-2xl shadow-black/40">
              <LeadCardView lead={activeLead} compact onOpen={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-2xl border border-border/50 bg-card px-4 py-2.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <TrendUp size={13} className="text-accent" />
          Weighted forecast
        </span>
        <span>
          {totals.count} leadů · očekávaná hodnota{" "}
          <span className="font-mono text-emerald-400">{formatCompactPrice(totals.expectedValue)}</span>
        </span>
        <span>
          očekávaný zisk <span className="font-mono text-accent">{formatCompactPrice(totals.expectedProfit)}</span>
        </span>
        <span className="text-muted/50">
          cena × pravděpodobnost fáze ({LEAD_STAGES.map((s) => `${s.label} ${Math.round(s.probability * 100)} %`).join(" · ")})
        </span>
      </div>

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={onLeadUpdated}
        onConverted={(id) => setLeads((prev) => (prev ? prev.filter((l) => l.id !== id) : prev))}
      />

      <StageTransitionModal
        key={`stage-modal-${openSeq}`}
        action={pending?.kind ?? null}
        lead={pending?.lead ?? null}
        onCancel={closePending}
        onMarkLost={confirmLost}
        onConvert={confirmConvert}
        onCloseOnly={confirmCloseOnly}
        onReopen={confirmReopen}
      />
    </div>
  );
}