"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Star, MapPin, Clock, CalendarBlank, ArrowRight, XCircle, CheckCircle } from "@phosphor-icons/react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { PropertyImage } from "@/components/ui/property-image";
import { RemovedListingBadge } from "@/components/ui/removed-listing-badge";
import { formatPrice, formatCompactPrice, portalLabel, splitAddress } from "@/lib/utils";
import { timeInStageDays } from "@/lib/leads";
import { currentTime } from "@/lib/clock";
import { cn } from "@/lib/utils";
import type { LeadItem } from "./types";

function marketDaysLabel(firstSeen: number | null | undefined, now: number): string | null {
  if (firstSeen == null || firstSeen <= 0) return null;
  const days = Math.max(0, Math.floor((now - firstSeen) / 86_400_000));
  return days === 0 ? "dnes" : `${days} dní`;
}

function AgingBadge({ lead }: { lead: LeadItem }) {
  if (lead.stage === "closed" || lead.stage === "lost") return null;
  const days = timeInStageDays(lead.stageEnteredAt, currentTime());
  if (days < 3) return null;
  const danger = days >= 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono",
        danger
          ? "bg-red-500/10 border border-red-500/20 text-red-400"
          : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
      )}
      title={`Ve fázi ${days} dní${danger ? " — bez pokroku hrozí chladnutí leadu" : ""}`}
    >
      <Clock size={10} weight="fill" />
      {days} dní
    </span>
  );
}

export function LeadCardView({
  lead,
  onOpen,
  onTogglePriority,
  onAdvance,
  onMarkLost,
  isDragging = false,
  style,
  setNodeRef,
  attributes,
  listeners,
}: {
  lead: LeadItem;
  onOpen: (lead: LeadItem) => void;
  onTogglePriority?: (lead: LeadItem) => void;
  onAdvance?: (lead: LeadItem) => void;
  onMarkLost?: (lead: LeadItem) => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
  setNodeRef?: (el: HTMLElement | null) => void;
  attributes?: React.HTMLAttributes<HTMLElement>;
  listeners?: Record<string, unknown>;
}) {
  const price = lead.propertyPrice ?? 0;
  const priority = lead.priority ?? 0;
  const isTerminal = lead.stage === "closed" || lead.stage === "lost";
  const isDeal = lead.stage === "closed" && !!lead.dealId;
  const now = currentTime();
  const overdue =
    !isTerminal && lead.nextStepDueAt != null && lead.nextStepDueAt > 0 && lead.nextStepDueAt < now;
  const { street, city } = splitAddress(lead.propertyAddress);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      className={cn(
        "group rounded-xl border bg-card p-3 cursor-grab active:cursor-grabbing transition-all",
        overdue ? "border-red-500/40" : "border-border/50",
        "hover:bg-card-hover hover:border-accent/20 hover:shadow-lg hover:shadow-black/20",
        isDragging && "opacity-40"
      )}
      title={lead.propertyTitle ?? undefined}
    >
      {(lead.propertyImageUrl || lead.propertyRemoved) && (
        <div className="mb-2 overflow-hidden rounded-lg">
          <PropertyImage
            src={lead.propertyImageUrl}
            alt={lead.propertyTitle ?? "Nemovitost"}
            score={lead.analysisScore}
            removed={lead.propertyRemoved}
            containerClassName="w-full h-20"
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-xs font-medium leading-snug break-words text-foreground group-hover:text-accent transition-colors">
          {lead.propertyTitle ?? "Neznámá nemovitost"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePriority?.(lead);
            }}
            title={`Priorita: ${priority === 0 ? "žádná" : priority === 1 ? "nízká" : priority === 2 ? "střední" : "vysoká"} (klik pro změnu)`}
            className={cn(
              "rounded-md p-0.5 transition-colors",
              priority > 0 ? "text-amber-400" : "text-muted/30 opacity-0 group-hover:opacity-100 hover:text-amber-400"
            )}
          >
            <Star size={13} weight={priority > 0 ? "fill" : "regular"} />
          </button>
          <ScoreGauge score={lead.analysisScore ?? 0} size={26} strokeWidth={2.5} showLabel={false} />
        </div>
      </div>

      {(street || city || lead.propertyPortalName) && (
        <div className="mb-1.5 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            {(street || city) && (
              <MapPin size={10} weight="fill" className="shrink-0 text-accent/70" />
            )}
            <span
              className="truncate text-[11px] font-medium leading-snug text-foreground/90"
              title={street || lead.propertyAddress || undefined}
            >
              {street || portalLabel(lead.propertyPortalName)}
            </span>
          </div>
          {city && (
            <div
              className="pl-[15px] text-[10px] leading-snug text-muted"
              title={lead.propertyAddress ?? undefined}
            >
              {city}
            </div>
          )}
        </div>
      )}

      {(lead.stage === "meeting" && lead.stageData?.meeting?.date) ||
      (lead.stage === "offer" && lead.stageData?.offer?.amount) ||
      (lead.stage === "negotiation" && lead.stageData?.negotiation?.currentAmount      ) ? (
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {lead.stage === "meeting" && lead.stageData?.meeting?.date && (
            <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono text-blue-400">
              <CalendarBlank size={10} weight="bold" />
              {new Date(lead.stageData.meeting.date).toLocaleDateString("cs-CZ")}{" "}
              {new Date(lead.stageData.meeting.date).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {lead.stage === "offer" && lead.stageData?.offer?.amount != null && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono text-amber-400">
              💰 {formatPrice(lead.stageData.offer.amount)}
            </span>
          )}
          {lead.stage === "negotiation" && lead.stageData?.negotiation?.currentAmount != null && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
              🤝 {formatPrice(lead.stageData.negotiation.currentAmount)}
            </span>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 mb-1.5">
        <AgingBadge lead={lead} />
        {isDeal && (
          <span
            className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400"
            title="Lead byl převeden na deal"
          >
            <CheckCircle size={10} weight="fill" /> Deal
          </span>
        )}
        {overdue && (
          <span
            className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/25 px-1.5 py-0.5 text-[10px] font-mono text-red-400"
            title={`Další krok propadl: ${lead.nextStep ?? "bez popisu"}`}
          >
            <Clock size={10} weight="fill" /> Krok propadl
          </span>
        )}
        {lead.nextStep && (
          <span className="inline-flex items-center gap-1 rounded bg-accent/10 border border-accent/20 px-1.5 py-0.5 text-[10px] text-accent max-w-[200px]">
            <span className="truncate" title={lead.nextStep}>→ {lead.nextStep}</span>
            {lead.nextStepDueAt != null && lead.nextStepDueAt > 0 && (
              <span className="shrink-0 text-accent/70">
                (do {new Date(lead.nextStepDueAt).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })})
              </span>
            )}
          </span>
        )}
      </div>

      {lead.notes && (
        <p className="mb-1.5 text-[10px] leading-relaxed text-muted/70 italic break-words whitespace-pre-wrap">
          {lead.notes}
        </p>
      )}

      {lead.propertyRemoved && (
        <RemovedListingBadge
          neutral={isTerminal}
          className="mb-1.5"
        />
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-1.5">
        <span className="text-sm font-semibold font-mono text-amber-400">
          {price > 0 ? formatPrice(price) : "—"}
        </span>
        {lead.propertyPricePerSqm != null && (
          <span className="text-[10px] text-muted font-mono">{formatCompactPrice(lead.propertyPricePerSqm)}/m²</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-2">
          {lead.propertyArea != null && (
            <span className="rounded bg-border/20 px-1.5 py-0.5 text-[10px] text-muted font-mono">{lead.propertyArea} m²</span>
          )}
          {lead.propertyRooms && (
            <span className="rounded bg-border/20 px-1.5 py-0.5 text-[10px] text-muted font-mono">{lead.propertyRooms}</span>
          )}
        </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-muted/50">
        <span className="min-w-0 truncate">
          {lead.propertyFirstSeen != null && lead.propertyFirstSeen > 0 && (
            <span
              title={`Na trhu od ${new Date(lead.propertyFirstSeen).toLocaleDateString("cs-CZ")}`}
            >
              {marketDaysLabel(lead.propertyFirstSeen, now)} na trhu
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {!isTerminal && onAdvance && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(lead);
              }}
              title="Posunout do další fáze"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted/40 opacity-0 group-hover:opacity-100 hover:text-accent hover:bg-accent/10 transition-all"
            >
              <ArrowRight size={12} weight="bold" />
            </button>
          )}
          {!isTerminal && onMarkLost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkLost(lead);
              }}
              title="Označit jako ztraceno"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted/40 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <XCircle size={12} weight="bold" />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export function LeadCard(props: Omit<Parameters<typeof LeadCardView>[0], "style" | "setNodeRef" | "attributes" | "listeners" | "isDragging">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.lead.id,
    data: { stage: props.lead.stage },
  });

  return (
    <LeadCardView
      {...props}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
    />
  );
}