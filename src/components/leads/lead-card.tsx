"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Star, MapPin, Clock, CalendarBlank, ArrowRight, XCircle, CheckCircle, Handshake, Trash } from "@phosphor-icons/react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { PropertyImage } from "@/components/ui/property-image";
import { RemovedListingBadge } from "@/components/ui/removed-listing-badge";
import { AmountInput } from "@/components/ui/amount-input";
import { formatPrice, formatCompactPrice, portalLabel, splitAddress, formatAmountInput } from "@/lib/utils";
import { timeInStageDays } from "@/lib/leads";
import { currentTime } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { COOPERATION_STRATEGIES } from "@/lib/cooperation-models";
import type { LeadItem } from "./types";

/**
 * Převod textu ceny z promptu na číslo (stejně jako zbytek aplikace —
 * kalkulačka, dražby, investor modal). type="number" vrací pro česky
 * formátované ceny („2 500 000") prázdný řetězec, takže by se potvrzení
 * tiše neprovedlo — proto se mezery/mezery NBSP/Kč odfiltrují.
 */
function parseAmountInput(value: string): number {
  const cleaned = value.replace(/\s+/g, "").replace(/Kč/gi, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
  onDelete,
  onAgree,
  onAgreeCancel,
  negotiationPrompt = false,
  investorName,
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
  onDelete?: (lead: LeadItem) => void;
  onAgree?: (lead: LeadItem, amount: number) => void;
  onAgreeCancel?: () => void;
  negotiationPrompt?: boolean;
  investorName?: string | null;
  isDragging?: boolean;
  style?: React.CSSProperties;
  setNodeRef?: (el: HTMLElement | null) => void;
  attributes?: React.HTMLAttributes<HTMLElement>;
  listeners?: Record<string, unknown>;
}) {
  const [agreeing, setAgreeing] = useState(false);
  const [agreeAmount, setAgreeAmount] = useState("");
  const agreeAmountNum = parseAmountInput(agreeAmount);
  const agreeAmountInvalid = agreeAmount.trim() !== "" && agreeAmountNum <= 0;
  const price = lead.propertyPrice ?? 0;
  const priority = lead.priority ?? 0;
  const isTerminal = lead.stage === "closed" || lead.stage === "lost";
  const isDeal = lead.stage === "closed" && !!lead.dealId;
  const promptNegotiation = lead.stage === "negotiation" && negotiationPrompt && !!onAgree && !isDragging;
  const showQuickAgree = (lead.stage === "contacted" || lead.stage === "meeting") && !!onAgree && !isDragging;
  const agreeInputOpen = agreeing || promptNegotiation;
  const now = currentTime();
  const overdue =
    !isTerminal && lead.nextStepDueAt != null && lead.nextStepDueAt > 0 && lead.nextStepDueAt < now;
  const { street, city } = splitAddress(lead.propertyAddress);
  const reserved =
    lead.stage === "negotiation" && lead.portalStatus === "reserved";
  const reservedHoursLeft =
    reserved && lead.portalExpiresAt != null && lead.portalExpiresAt > now
      ? Math.max(1, Math.ceil((lead.portalExpiresAt - now) / 3_600_000))
      : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      className={cn(
        "group rounded-xl border bg-card p-2 cursor-grab active:cursor-grabbing transition-all",
        overdue ? "border-red-500/40" : "border-border/50",
        "hover:bg-card-hover hover:border-accent/20 hover:shadow-lg hover:shadow-black/20",
        isDragging && "opacity-40"
      )}
      title={lead.propertyTitle ?? undefined}
    >
      {(lead.propertyImageUrl || lead.propertyRemoved) && (
        <div className="mb-1.5 overflow-hidden rounded-lg">
          <PropertyImage
            src={lead.propertyImageUrl}
            alt={lead.propertyTitle ?? "Nemovitost"}
            score={lead.analysisScore}
            removed={lead.propertyRemoved}
            containerClassName="w-full h-14"
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-xs font-medium leading-snug line-clamp-2 text-foreground group-hover:text-accent transition-colors">
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
              "rounded-md p-1.5 transition-colors",
              priority > 0 ? "text-amber-400" : "text-muted/30 opacity-0 group-hover:opacity-100 max-lg:opacity-100 hover:text-amber-400"
            )}
          >
            <Star size={13} weight={priority > 0 ? "fill" : "regular"} />
          </button>
          <ScoreGauge score={lead.analysisScore ?? 0} size={26} strokeWidth={2.5} showLabel={false} />
        </div>
      </div>

      {(street || city || lead.propertyPortalName) && (
        <div className="mb-1 flex items-center gap-1 min-w-0">
          {(street || city) && (
            <MapPin size={10} weight="fill" className="shrink-0 text-accent/70" />
          )}
          <span
            className="truncate text-[11px] font-medium leading-snug text-foreground/90"
            title={lead.propertyAddress ?? street ?? undefined}
          >
            {[street || portalLabel(lead.propertyPortalName), city].filter(Boolean).join(", ")}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 mb-1">
        {lead.stage === "meeting" && lead.stageData?.meeting?.date && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono text-blue-400">
            <CalendarBlank size={10} weight="bold" />
            {new Date(lead.stageData.meeting.date).toLocaleDateString("cs-CZ")}{" "}
            {new Date(lead.stageData.meeting.date).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <AgingBadge lead={lead} />
        {isDeal && (
          <span
            className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400"
            title="Lead byl převeden na deal"
          >
            <CheckCircle size={10} weight="fill" /> Deal
          </span>
        )}
        {lead.stage === "closed" && lead.stageData?.negotiation?.currentAmount != null && (
          <span
            className="inline-flex items-center gap-1 rounded bg-emerald-600/10 border border-emerald-600/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-500"
            title="Prodejní cena vyjednaná s prodejcem"
          >
            <Handshake size={10} weight="bold" /> {formatPrice(lead.stageData.negotiation.currentAmount)}
          </span>
        )}
        {isDeal && investorName && lead.portalReservedInvestorId && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400">
            <span className="truncate max-w-[120px]" title={investorName}>
              {investorName}
            </span>
            {lead.portalReservedStrategy && (
              <span className="shrink-0 text-blue-400/70">
                {COOPERATION_STRATEGIES[lead.portalReservedStrategy as keyof typeof COOPERATION_STRATEGIES] ?? lead.portalReservedStrategy}
              </span>
            )}
          </span>
        )}
        {reserved && (
          <span
            className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400"
            title="Investor rezervoval nabídku — do 72 h potvrdit zájem"
          >
            🔒 Rezervováno{investorName ? `: ${investorName}` : ""}
            {reservedHoursLeft != null && <span className="text-emerald-400/70">· vyprší za {reservedHoursLeft} h</span>}
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
            {lead.nextStepDueAt != null && Number(lead.nextStepDueAt) > 0 && (
              <span className="shrink-0 text-accent/70">
                (do {new Date(Number(lead.nextStepDueAt)).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })})
              </span>
            )}
          </span>
        )}
      </div>

      {lead.notes && (
        <p className="mb-1 text-[10px] leading-relaxed text-muted/70 italic break-words whitespace-pre-wrap line-clamp-2">
          {lead.notes}
        </p>
      )}

      {lead.propertyRemoved && (
        <RemovedListingBadge
          neutral={isTerminal}
          className="mb-1"
        />
      )}

      {(showQuickAgree || promptNegotiation) && (
        <div className="mb-1.5">
          {!agreeInputOpen ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAgreeAmount(lead.analysisTargetPurchasePrice ? String(lead.analysisTargetPurchasePrice) : "");
                setAgreeing(true);
              }}
              title="Vyjednáno s prodejcem — přesunout do fáze Vyjednáno"
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Handshake size={11} weight="bold" /> Dohodnuto za...
            </button>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                <AmountInput
                  autoFocus
                  value={agreeAmount}
                  onChange={(e) => setAgreeAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && agreeAmountNum > 0) {
                      onAgree?.(lead, agreeAmountNum);
                    }
                    if (e.key === "Escape") {
                      if (promptNegotiation) onAgreeCancel?.();
                      else setAgreeing(false);
                    }
                  }}
                  placeholder={lead.analysisTargetPurchasePrice ? formatAmountInput(lead.analysisTargetPurchasePrice) : "cena"}
                  className="w-full min-w-0 rounded-lg border border-emerald-500/30 bg-card px-2 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (agreeAmountNum > 0) onAgree?.(lead, agreeAmountNum);
                  }}
                  className="shrink-0 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (promptNegotiation) onAgreeCancel?.();
                    else setAgreeing(false);
                  }}
                  className="shrink-0 rounded-lg border border-border/40 px-2 py-1 text-[10px] text-muted hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              {agreeAmountInvalid && (
                <p className="mt-1 text-[10px] font-medium text-red-400">
                  Zadejte platnou cenu v Kč — např. 2500000
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="min-w-0">
          <span className="block text-sm font-semibold font-mono text-amber-400 leading-snug break-words">
            {price > 0 ? formatPrice(price) : "—"}
          </span>
          {lead.propertyPricePerSqm != null && (
            <span className="block text-[10px] text-muted font-mono leading-tight">
              {formatCompactPrice(lead.propertyPricePerSqm)}/m²
            </span>
          )}
          {lead.analysisTargetPurchasePrice != null && lead.analysisTargetPurchasePrice > 0 && (
            <>
              <span className="mt-0.5 block text-[10px] font-mono leading-tight text-muted">
                Ideální: {formatPrice(lead.analysisTargetPurchasePrice)}
              </span>
              {lead.propertyArea != null && lead.propertyArea > 0 && (
                <span className="block text-[10px] text-muted font-mono leading-tight">
                  {formatCompactPrice(Math.round(lead.analysisTargetPurchasePrice / lead.propertyArea))}/m²
                </span>
              )}
            </>
          )}
        </span>
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
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {((!isTerminal && (onAdvance || onMarkLost)) || onDelete) && (
            <span className="flex items-center gap-1.5 w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:w-auto group-hover:opacity-100 max-lg:w-auto max-lg:overflow-visible max-lg:opacity-100">
              {!isTerminal && onAdvance && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdvance(lead);
                  }}
                  title="Posunout do další fáze"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted/40 hover:text-accent hover:bg-accent/10 transition-all"
                >
                  <ArrowRight size={13} weight="bold" />
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <XCircle size={13} weight="bold" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(lead);
                  }}
                  title="Odstranit z pipeline"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash size={13} weight="bold" />
                </button>
              )}
            </span>
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