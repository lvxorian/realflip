import { conditionLabel } from "@/lib/utils";
import type { StageData } from "@/components/leads/types";

export type PortalStatus = "available" | "reserved";

export interface FlipDealView {
  type: "flip";
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  arv: number | null;
  cashOnCash: number | null;
}

export interface RentalDealView {
  type: "rental";
  grossYield: number | null;
  netYield: number | null;
  netYieldAfterTax: number | null;
  capRate: number | null;
  cashFlowMonthly: number | null;
}

export type DealMetricsView = FlipDealView | RentalDealView;

/** Uložený "snímek" z kalkulačky — přesně ta čísla, která admin v RealFlip
 * kalkulačce viděl při posledním Uložit. Portál je zobrazuje bez přepočtu. */
export interface CalcSnapshotFlip {
  mode: "flip";
  purchasePriceUsed: number | null;
  arv: number | null;
  renovationCost: number | null;
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  cashOnCash: number | null;
  totalCost: number | null;
  targetPurchasePrice: number | null;
}

export interface CalcSnapshotRental {
  mode: "rental";
  purchasePriceUsed: number | null;
  monthlyRent: number | null;
  netYield: number | null;
  grossYield: number | null;
  netYieldAfterTax: number | null;
  capRate: number | null;
  cashFlowMonthly: number | null;
  totalInvested: number | null;
  targetPurchasePrice: number | null;
}

export type CalcSnapshot = CalcSnapshotFlip | CalcSnapshotRental;

export function parseCalcSnapshot(raw: string | null | undefined): CalcSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CalcSnapshot;
    return parsed && (parsed.mode === "flip" || parsed.mode === "rental") ? parsed : null;
  } catch {
    return null;
  }
}

export interface InvestorPortalItem {
  id: string;
  district: string | null;
  city: string | null;
  condition: string;
  area: number | null;
  rooms: string | null;
  floor: number | null;
  originalPrice: number | null;
  offerPrice: number | null;
  savingsPct: number | null;
  calcMode: "flip" | "rental";
  deal: DealMetricsView;
  renovationCost: number | null;
  snapshot: CalcSnapshot | null;
  status: PortalStatus;
  reservedByMe: boolean;
  reservedByName: string | null;
  overBudget: boolean;
}

export interface PortalRow {
  leadId: string;
  portalStatus: string | null;
  reservedById: string | null;
  reservedByName: string | null;
  district: string | null;
  city: string | null;
  condition: string | null;
  area: number | null;
  rooms: string | null;
  floor: number | null;
  originalPrice: number | null;
  stageData: unknown;
  arv: number | null;
  renovationCost: number | null;
  monthlyRent: number | null;
  locationCategory: string | null;
  calcMode: string | null;
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  cashOnCash: number | null;
  rentalYield: number | null;
  cashFlowMonthly: number | null;
  calcSnapshot: string | null;
}

export function parseStageData(raw: unknown): StageData | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as StageData;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as StageData;
  return null;
}

export function offerPriceOf(stageData: StageData | null): number | null {
  const negotiation = stageData?.negotiation;
  if (negotiation && typeof negotiation.currentAmount === "number" && negotiation.currentAmount > 0) {
    return Math.round(negotiation.currentAmount);
  }
  const offer = stageData?.offer;
  if (offer && typeof offer.amount === "number" && offer.amount > 0) {
    return Math.round(offer.amount);
  }
  return null;
}

function resolveCalcMode(raw: string | null | undefined): "flip" | "rental" {
  return raw === "rental" ? "rental" : "flip";
}

/** Deal hodnoty se berou PŘÍMO z uloženého snapshotu kalkulačky (verbatim).
 *  Když snapshot chybí, použij se uložená analýza (sloupce
 *  property_analysis.net_profit/roi/rental_yield). Nic se nepřepočítává. */
function dealFromColumns(row: PortalRow, calcMode: "flip" | "rental"): DealMetricsView {
  const snapshot = parseCalcSnapshot(row.calcSnapshot);

  if (calcMode === "flip") {
    const s = snapshot && snapshot.mode === "flip" ? snapshot : null;
    return {
      type: "flip",
      netProfit: s ? s.netProfit : row.netProfit,
      roi: s ? s.roi : row.roi,
      annualizedRoi: s ? s.annualizedRoi : row.annualizedRoi,
      arv: s ? s.arv : row.arv,
      cashOnCash: s ? s.cashOnCash : row.cashOnCash,
    };
  }

  const s = snapshot && snapshot.mode === "rental" ? snapshot : null;
  return {
    type: "rental",
    grossYield: s ? s.grossYield : null,
    netYield: s ? s.netYield : row.rentalYield,
    netYieldAfterTax: s ? s.netYieldAfterTax : null,
    capRate: s ? s.capRate : null,
    cashFlowMonthly: s ? s.cashFlowMonthly : row.cashFlowMonthly,
  };
}

export function toPortalView(
  row: PortalRow,
  investorId: string,
  budget: { budget: number | null; unlimited: boolean }
): InvestorPortalItem {
  const stageData = parseStageData(row.stageData);
  const offerPrice = offerPriceOf(stageData) ?? row.originalPrice ?? null;
  const savingsPct =
    offerPrice !== null && row.originalPrice && row.originalPrice > 0
      ? Math.round(((row.originalPrice - offerPrice) / row.originalPrice) * 1000) / 10
      : null;
  const overBudget =
    !budget.unlimited && budget.budget !== null && budget.budget > 0 && offerPrice !== null
      ? offerPrice > budget.budget
      : false;

  const calcMode = resolveCalcMode(row.calcMode);

  return {
    id: row.leadId,
    district: row.district,
    city: row.city,
    condition: conditionLabel(row.condition),
    area: row.area,
    rooms: row.rooms,
    floor: row.floor,
    originalPrice: row.originalPrice,
    offerPrice,
    savingsPct,
    calcMode,
    deal: dealFromColumns(row, calcMode),
    renovationCost: row.renovationCost,
    snapshot: parseCalcSnapshot(row.calcSnapshot),
    status: row.portalStatus === "reserved" ? "reserved" : "available",
    reservedByMe: row.reservedById === investorId,
    reservedByName: row.reservedById ? row.reservedByName : null,
    overBudget,
  };
}