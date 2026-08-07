import { conditionLabel } from "@/lib/utils";
import { computeFlipDeal, computeRentalDeal } from "@/lib/investor/deal-metrics";
import type { StageData } from "@/components/leads/types";

export type PortalStatus = "available" | "reserved";

export interface FlipDealView {
  type: "flip";
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  arv: number | null;
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
  const price = offerPrice ?? 0;

  const deal: DealMetricsView =
    calcMode === "rental"
      ? {
          type: "rental",
          ...computeRentalDeal({
            price,
            monthlyRent: row.monthlyRent,
            area: row.area,
            cityKey: row.city,
            locationCategory: row.locationCategory,
          }),
        }
      : {
          type: "flip",
          ...computeFlipDeal({
            price,
            arv: row.arv,
            renovationCost: row.renovationCost,
            area: row.area,
          }),
        };

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
    deal,
    renovationCost: row.renovationCost,
    status: row.portalStatus === "reserved" ? "reserved" : "available",
    reservedByMe: row.reservedById === investorId,
    reservedByName: row.reservedById ? row.reservedByName : null,
    overBudget,
  };
}

export { costsBreakdownForDeal } from "@/lib/investor/deal-metrics";