export const TERMINAL_STAGES = new Set(["closed", "lost"]);

export function isTerminalStage(stage: string | null | undefined): boolean {
  return typeof stage === "string" && TERMINAL_STAGES.has(stage);
}

/**
 * Předvyplněná kupní cena pro modal „Uzavřít deal":
 * nabídnutá cena (offer.amount) > cílová nákupní cena z analýzy > cenovka nemovitosti.
 */
export function closedDealPrefill(lead: {
  stageData?: { offer?: { amount?: number | null } | null } | null;
  analysisTargetPurchasePrice?: number | null;
  propertyPrice?: number | null;
}): number {
  const offer = lead.stageData?.offer?.amount;
  if (typeof offer === "number" && offer > 0) return offer;
  if (typeof lead.analysisTargetPurchasePrice === "number" && lead.analysisTargetPurchasePrice > 0)
    return lead.analysisTargetPurchasePrice;
  if (typeof lead.propertyPrice === "number" && lead.propertyPrice > 0) return lead.propertyPrice;
  return 0;
}