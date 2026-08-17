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
import { WarningCircle, Kanban } from "@phosphor-icons/react";
import { LEAD_STAGES, LEAD_STAGE_KEYS, resolveDropTarget } from "@/lib/leads";
import { moveLeadToStage, reorderLeadInStage } from "@/lib/pipeline-board";
import { cn, formatCompactPrice } from "@/lib/utils";
import { currentTime } from "@/lib/clock";
import { toast } from "sonner";
import { LeadCard, LeadCardView } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { DeleteLeadModal } from "./delete-lead-modal";
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
        "flex min-w-[160px] lg:min-w-0 max-w-[360px] flex-1 basis-0 flex-col snap-start @container rounded-xl transition-all",
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
        <div key={s.key} className="flex min-w-[160px] lg:min-w-0 flex-1 basis-0 flex-col gap-2 snap-start">
          <div className="h-6 w-24 rounded-lg bg-border/20 animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-border/10 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface PatchResult {
  ok: boolean;
  error: string | null;
}

function patchLead(id: string, body: Record<string, unknown>): Promise<PatchResult> {
  return fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      if (res.ok) return { ok: true, error: null };
      const data = await res.json().catch(() => null);
      return { ok: false, error: typeof data?.error === "string" ? data.error : `HTTP ${res.status}` };
    })
    .catch(() => ({ ok: false, error: "Chyba sítě" }));
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

interface PendingNegotiation {
  leadId: string;
  fromStage: string;
  fromPosition: number;
  newPosition: number;
}

/** Fáze Vyjednáno vyžaduje domluvenou cenu — lead se serveru nesmí poslat bez ní. */
function hasNegotiatedPrice(lead: LeadItem) {
  return (lead.stageData?.negotiation?.currentAmount ?? 0) > 0;
}

export function LeadsBoard() {
  const [leads, setLeads] = useState<LeadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadFilterState>(INITIAL_LEAD_FILTERS);
  const [activeLead, setActiveLead] = useState<LeadItem | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [pendingNegotiation, setPendingNegotiation] = useState<PendingNegotiation | null>(null);
  const [deletingLead, setDeletingLead] = useState<LeadItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openSeq, setOpenSeq] = useState(0);
  const [latestOver, setLatestOver] = useState<DragTarget | null>(null);
  const [investorNames, setInvestorNames] = useState<Record<string, string>>({});
  const wasDragging = useRef(false);
  const requestSeq = useRef(0);
  const leadsRef = useRef<LeadItem[] | null>(null);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    fetch("/api/investors", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { id: string; name: string }[]) => {
        if (Array.isArray(d)) setInvestorNames(Object.fromEntries(d.map((i) => [i.id, i.name ?? "??"])));
      })
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadLeads = useCallback(() => {
    fetch("/api/leads", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: LeadItem[]) => setLeads(data))
      .catch(() => setError("Nepodařilo se načíst pipeline."));
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

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

  const onLeadUpdated = useCallback((updated: LeadItem) => {
    setLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)) : prev));
  }, []);

  /** Trvalé odstranění leadu z pipeline — lead zmizí z boardu, nemovitost zůstává. */
  const removeLeadFromBoard = useCallback((leadId: string) => {
    setLeads((prev) => (prev ? prev.filter((l) => l.id !== leadId) : prev));
  }, []);

  /** Otevře potvrzovací modal (z hover akce karty nebo danger zóny v draweru). */
  const handleRequestDelete = useCallback((lead: LeadItem) => {
    setDeletingLead(lead);
  }, []);

  async function confirmDeleteLead() {
    const lead = deletingLead;
    if (!lead) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Odstranění leadu se nezdařilo");
        return;
      }
      toast.success("Lead odstraněn z pipeline");
      setDeletingLead(null);
      setSelectedLead(null);
      removeLeadFromBoard(lead.id);
    } catch {
      toast.error("Odstranění leadu se nezdařilo — zkontrolujte připojení");
    } finally {
      setDeleting(false);
    }
  }

  function cancelDeleteLead() {
    if (deleting) return;
    setDeletingLead(null);
  }

  const handlePriorityToggle = useCallback((lead: LeadItem) => {
    const cycle = [0, 1, 2, 3];
    const next = cycle[(cycle.indexOf(lead.priority ?? 0) + 1) % cycle.length];
    onLeadUpdated({ ...lead, priority: next });
    void patchLead(lead.id, { priority: next }).then((res) => {
      if (!res.ok) {
        onLeadUpdated({ ...lead, priority: lead.priority });
        toast.error(res.error ?? "Změna priority se neuložila");
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

    return patchLead(leadId, body).then((res) => {
      if (requestId !== requestSeq.current) return res.ok;
      if (!res.ok) {
        const reverted = moveLeadToStage(base, leadId, previousStage, null, previousPosition ?? 0);
        setLeads(reverted?.leads ?? base);
        toast.error(res.error ? `${res.error} — přesun vrácen` : "Přesun selhal — vráceno zpět");
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

  /** Rychlá akce: dohoda s prodejcem po telefonu/na prohlídce → rovnou do Vyjednáno. */
  function handleAgree(lead: LeadItem, amount: number) {
    const history = lead.stageData?.negotiation?.history ?? [];
    const stageData = {
      ...lead.stageData,
      negotiation: {
        currentAmount: amount,
        history: [...history, { price: amount, date: new Date().toISOString(), by: "them" as const }],
      },
    };
    void patchLead(lead.id, { stage: "negotiation", stageData }).then((res) => {
      if (!res.ok) {
        toast.error(res.error ?? "Dohodu se nepodařilo uložit");
        return;
      }
      onLeadUpdated({ ...lead, stage: "negotiation", stageData });
      const stageLabel = LEAD_STAGES.find((s) => s.key === "negotiation")?.label ?? "Vyjednáno";
      toast.success(`Dohodnuto za ${formatCompactPrice(amount)} — přesunuto do „${stageLabel}"`);
    });
  }

  /** Přesun do Vyjednáno bez ceny → karta se optimisticky přesune a vyzve k zadání ceny. */
  function beginNegotiation(lead: LeadItem) {
    const base = leadsRef.current ?? leads;
    if (!base) return;
    const moved = moveLeadToStage(base, lead.id, "negotiation", null);
    if (!moved) return;
    setLeads(moved.leads);
    setPendingNegotiation({
      leadId: lead.id,
      fromStage: lead.stage,
      fromPosition: lead.position ?? 0,
      newPosition: moved.newPos,
    });
  }

  /** Zrušení zadávání ceny → karta se vrátí do původní fáze a pozice. */
  function cancelNegotiation() {
    const p = pendingNegotiation;
    setPendingNegotiation(null);
    if (!p) return;
    const base = leadsRef.current ?? leads;
    if (!base) return;
    const reverted = moveLeadToStage(base, p.leadId, p.fromStage, null, p.fromPosition);
    if (reverted) setLeads(reverted.leads);
  }

  /** Potvrzení vyjednané ceny z karty (quick action i prompt po přesunu do Vyjednáno). */
  function confirmNegotiationPrice(lead: LeadItem, amount: number) {
    const p = pendingNegotiation?.leadId === lead.id ? pendingNegotiation : null;
    setPendingNegotiation(null);
    const history = lead.stageData?.negotiation?.history ?? [];
    const stageData = {
      ...lead.stageData,
      negotiation: {
        currentAmount: amount,
        history: [...history, { price: amount, date: new Date().toISOString(), by: "them" as const }],
      },
    };
    void patchLead(lead.id, { stage: "negotiation", position: p?.newPosition, stageData }).then((res) => {
      if (!res.ok) {
        if (p) {
          const base = leadsRef.current ?? leads;
          const reverted = base ? moveLeadToStage(base, p.leadId, p.fromStage, null, p.fromPosition) : null;
          if (reverted) setLeads(reverted.leads);
        }
        toast.error(res.error ?? "Vyjednanou cenu se nepodařilo uložit — přesun vrácen");
        return;
      }
      onLeadUpdated({ ...lead, stage: "negotiation", position: p?.newPosition ?? lead.position ?? 0, stageData });
      const stageLabel = LEAD_STAGES.find((s) => s.key === "negotiation")?.label ?? "Vyjednáno";
      toast.success(`Přesunuto do „${stageLabel}" za ${formatCompactPrice(amount)}`);
    });
  }

  /** Společný vstup pro quick action na kartách i prompt po přesunu do Vyjednáno. */
  function handleCardAgree(lead: LeadItem, amount: number) {
    if (pendingNegotiation?.leadId === lead.id) {
      confirmNegotiationPrice(lead, amount);
      return;
    }
    handleAgree(lead, amount);
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
        void patchLead(lead.id, { position: reordered.newPos }).then((res) => {
          if (requestId !== requestSeq.current) return;
          if (!res.ok) {
            setLeads(snapshot);
            toast.error(res.error ?? "Přesun selhal — vráceno zpět");
          }
        });
      }
      return;
    }

    // Terminální a zpětné přesuny jdou přes potvrzovací modal
    const fromTerminal = lead.stage === "closed" || lead.stage === "lost";
    // Do Vyjednáno bez domluvené ceny → karta sedne do sloupce a vyzve k zadání ceny přímo na sobě
    if (toStage === "negotiation" && !fromTerminal && !hasNegotiatedPrice(lead)) {
      beginNegotiation(lead);
      return;
    }
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
    } else if (next === "negotiation" && !hasNegotiatedPrice(lead)) {
      beginNegotiation(lead);
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
      // Lead zůstává ve sloupci Uzavřeno jako evidence dealu (přenačte se s dealId)
      loadLeads();
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
            const pct = items.length > 0 ? Math.round((items.length / maxCount) * 100) : 0;

            const now = currentTime();
            const overdueCount = items.filter(
              (l) =>
                l.stage !== "closed" &&
                l.stage !== "lost" &&
                l.nextStepDueAt != null &&
                l.nextStepDueAt > 0 &&
                l.nextStepDueAt < now
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
                {overdueCount > 0 && (
                  <div className="mb-2 px-1">
                    <span
                      className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-mono text-red-400"
                      title="Leadů s propadlým dalším krokem"
                    >
                      {overdueCount} overdue
                    </span>
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
                          onDelete={handleRequestDelete}
                          onAgree={handleCardAgree}
                          onAgreeCancel={cancelNegotiation}
                          negotiationPrompt={pendingNegotiation?.leadId === lead.id}
                          investorName={
                            lead.portalReservedInvestorId
                              ? investorNames[lead.portalReservedInvestorId] ?? null
                              : null
                          }
                        />
                      </Fragment>
                    ))}
                    {latestOver?.kind === "column" && latestOver.id === stage.key && items.length > 0 && <InsertionLine />}
                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/40 px-3 py-4 text-center text-[10px] text-muted/60">
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
              <LeadCardView lead={activeLead} onOpen={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={onLeadUpdated}
        onConverted={() => loadLeads()}
        onRequestDelete={handleRequestDelete}
      />

      <DeleteLeadModal
        lead={deletingLead}
        deleting={deleting}
        onCancel={cancelDeleteLead}
        onConfirm={confirmDeleteLead}
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