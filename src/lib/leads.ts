export const LEAD_STAGES = [
  { key: "new", label: "Nový", color: "border-l-accent", dot: "bg-accent", probability: 0.1 },
  { key: "contacted", label: "Telefonát", color: "border-l-blue-500", dot: "bg-blue-500", probability: 0.25 },
  { key: "meeting", label: "Prohlídka", color: "border-l-amber-500", dot: "bg-amber-500", probability: 0.4 },
  { key: "offer", label: "Nabídka", color: "border-l-emerald-500", dot: "bg-emerald-500", probability: 0.55 },
  { key: "negotiation", label: "Vyjednáno", color: "border-l-emerald-400", dot: "bg-emerald-400", probability: 0.75 },
  { key: "closed", label: "Uzavřeno", color: "border-l-emerald-600", dot: "bg-emerald-600", probability: 1 },
  { key: "lost", label: "Ztraceno", color: "border-l-red-500", dot: "bg-red-500", probability: 0 },
] as const;

export const LEAD_STAGE_KEYS = new Set<string>(LEAD_STAGES.map((s) => s.key));

export const LOST_REASONS = [
  { key: "price", label: "Cena — nedohoda" },
  { key: "sold_elsewhere", label: "Prodáno jinému kupci" },
  { key: "rehab_too_costly", label: "Rekonstrukce příliš drahá" },
  { key: "not_serious", label: "Prodejce neseriózní" },
  { key: "no_response", label: "Žádná odezva" },
  { key: "other", label: "Jiné" },
] as const;

export function isValidLeadStage(stage: string): boolean {
  return LEAD_STAGE_KEYS.has(stage);
}

export function stageProbability(stage: string): number {
  return LEAD_STAGES.find((s) => s.key === stage)?.probability ?? 0;
}

const DAY_MS = 86_400_000;

export function timeInStageMs(stageEnteredAt: number | null | undefined, now: number): number {
  if (stageEnteredAt == null || stageEnteredAt <= 0) return 0;
  return Math.max(0, now - stageEnteredAt);
}

export function timeInStageDays(stageEnteredAt: number | null | undefined, now: number): number {
  return Math.floor(timeInStageMs(stageEnteredAt, now) / DAY_MS);
}

/** 0 = klid, 1 = upozornění (>=3 dny), 2 = kritické (>=7 dní) */
export function agingLevel(days: number): 0 | 1 | 2 {
  if (days >= 7) return 2;
  if (days >= 3) return 1;
  return 0;
}

/** Deal value použitá pro weighted forecast: nabídnutá cena > cílová nákupní cena > cenovka */
export function leadDealValue(lead: {
  stageData?: { offer?: { amount?: number | null } | null } | null;
  analysisTargetPurchasePrice?: number | null;
  propertyPrice?: number | null;
}): number {
  const offerAmount = lead.stageData?.offer?.amount;
  if (typeof offerAmount === "number" && offerAmount > 0) return offerAmount;
  if (typeof lead.analysisTargetPurchasePrice === "number" && lead.analysisTargetPurchasePrice > 0)
    return lead.analysisTargetPurchasePrice;
  if (typeof lead.propertyPrice === "number" && lead.propertyPrice > 0) return lead.propertyPrice;
  return 0;
}

/** Očekávaná hodnota leadu = deal value × pravděpodobnost fáze (weighted forecast) */
export function leadExpectedValue(lead: {
  stage: string;
  stageData?: { offer?: { amount?: number | null } | null } | null;
  analysisTargetPurchasePrice?: number | null;
  propertyPrice?: number | null;
}): number {
  return leadDealValue(lead) * stageProbability(lead.stage);
}

/** Očekávaný zisk leadu = p × (ARV − cílová nákupní cena); 0, když chybí ARV nebo TPP */
export function leadExpectedProfit(lead: {
  stage: string;
  analysisArv?: number | null;
  analysisTargetPurchasePrice?: number | null;
}): number {
  const arv = lead.analysisArv ?? 0;
  const tpp = lead.analysisTargetPurchasePrice ?? 0;
  if (arv <= 0 || tpp <= 0) return 0;
  return (arv - tpp) * stageProbability(lead.stage);
}

export const TIME_IN_STAGE_WARN_DAYS = 3;
export const TIME_IN_STAGE_DANGER_DAYS = 7;

/**
 * Rozlišení cílové fáze z dnd-kit `over` události.
 * 1) over.id = lead id v seznamu → fáze toho leadu
 * 2) over.id/data = klíč fáze → fáze
 * 3) jiné → null (mimo board / neznámý cíl)
 */
export function resolveDropTarget(
  overId: unknown,
  overData: { stage?: unknown } | null | undefined,
  leads: { id: string; stage: string }[] | null | undefined
): string | null {
  if (typeof overId !== "string") return null;
  const overLead = leads?.find((l) => l.id === overId);
  if (overLead) return overLead.stage;
  if (typeof overData?.stage === "string" && isValidLeadStage(overData.stage)) return overData.stage;
  if (isValidLeadStage(overId)) return overId;
  return null;
}