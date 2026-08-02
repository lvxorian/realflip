"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Star, MapPin } from "@phosphor-icons/react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatCompactPrice, formatRelative, conditionLabel, portalLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LeadItem } from "./types";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function LeadCard({
  lead,
  onOpen,
  compact = false,
}: {
  lead: LeadItem;
  onOpen: (lead: LeadItem) => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const price = lead.propertyPrice ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      className={cn(
        "group rounded-xl border border-border/50 bg-card p-3 cursor-grab active:cursor-grabbing transition-all",
        "hover:bg-card-hover hover:border-accent/20 hover:shadow-lg hover:shadow-black/20",
        "@max-[240px]:p-2.5",
        isDragging && "opacity-40"
      )}
      title={lead.propertyTitle ?? undefined}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-xs font-medium leading-snug line-clamp-2 @max-[240px]:line-clamp-1 text-foreground group-hover:text-accent transition-colors">
          {lead.propertyTitle ?? "Neznámá nemovitost"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {lead.priority != null && lead.priority > 0 && (
            <Star size={13} weight="fill" className="text-amber-400" />
          )}
          <ScoreGauge score={lead.analysisScore ?? 0} size={26} strokeWidth={2.5} showLabel={false} />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold font-mono text-amber-400 @max-[240px]:text-xs">
          {price > 0 ? formatPrice(price) : "—"}
        </span>
        {lead.propertyPricePerSqm != null && (
          <span className="text-[10px] text-muted font-mono @max-[240px]:hidden">{formatCompactPrice(lead.propertyPricePerSqm)}/m²</span>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-1 mb-2 @max-[240px]:hidden">
          {lead.propertyArea != null && (
            <span className="rounded bg-border/20 px-1.5 py-0.5 text-[10px] text-muted font-mono">{lead.propertyArea} m²</span>
          )}
          {lead.propertyRooms && (
            <span className="rounded bg-border/20 px-1.5 py-0.5 text-[10px] text-muted font-mono">{lead.propertyRooms}</span>
          )}
          {lead.propertyCondition && (
            <Badge variant="outline" size="sm">{conditionLabel(lead.propertyCondition)}</Badge>
          )}
        </div>
      )}

      {!compact && (lead.contactName || lead.contactPhone) && (
        <div className="flex items-center gap-1.5 mb-1.5 @max-[240px]:hidden">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent text-[10px] font-bold">
            {initials(lead.contactName)}
          </span>
          <span className="text-[11px] text-muted truncate">{lead.contactName ?? "Bez jména"}</span>
          {lead.contactPhone && (
            <span className="text-[10px] text-muted/60 font-mono truncate">{lead.contactPhone}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted/50 @max-[240px]:hidden">
        <span className="flex items-center gap-1 min-w-0">
          {lead.propertyAddress ? (
            <>
              <MapPin size={10} weight="fill" className="shrink-0" />
              <span className="truncate">{lead.propertyAddress}</span>
            </>
          ) : (
            <span>{portalLabel(lead.propertyPortalName)}</span>
          )}
        </span>
        {lead.updatedAt != null && <span className="shrink-0">{formatRelative(lead.updatedAt)}</span>}
      </div>
    </div>
  );
}
