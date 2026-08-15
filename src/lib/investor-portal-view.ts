import { conditionLabel } from "@/lib/utils";
import type { StageData } from "@/components/leads/types";
import { strategiesFromAvailability, type CooperationStrategy } from "@/lib/cooperation-models";

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

export interface CooperationView {
  /** Strategie dostupné na tomto obchodu (před globální politikou portálu). */
  availableStrategies: CooperationStrategy[];
  netProfitTotal: number | null;
  investorProfitFiftyFifty: number | null;
  investorProfitSourcing: number | null;
  sourcingFee: number | null;
}

export interface CalcSnapshotFlip {
  mode: "flip";
  /** Cena, z níž se počítá „Výpočet při cílové ceně" (PDF kalkulačka). */
  purchasePriceUsed: number | null;
  arv: number | null;
  renovationCost: number | null;
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  cashOnCash: number | null;
  totalCost: number | null;
  targetPurchasePrice: number | null;
  /** Položkový rozpis (PDF kalkulačka) – null = není k dispozici. */
  legalFees: number | null;
  appraisalFee: number | null;
  contingency: number | null;
  holdingCosts: number | null;
  holdingMonths: number | null;
  sellingCommission: number | null;
  marketingPhoto: number | null;
  mortgageCost: number | null;
  sourcingFee: number | null;
  incomeTax: number | null;
  /** Způsob spolupráce (flip): čísla pro 50/50 i sourcing fee přímo z kalkulačky. */
  cooperation?: FlipCooperationSnapshot | null;
}

export interface FlipCooperationSnapshot {
  /** Jak je obchod nabízen: obojí / jen 50/50 / jen sourcing fee. */
  availability: "both" | "fifty-fifty" | "sourcing-fee";
  /** Čistý zisk celého obchodu (bez sourcing fee, před dělením 50/50). */
  netProfitTotal: number | null;
  /** Zisk investora při 50/50 (polovina zisk celého obchodu). */
  investorProfitFiftyFifty: number | null;
  /** Zisk investora při sourcing fee (po odečtení poplatku). */
  investorProfitSourcing: number | null;
  sourcingFee: number | null;
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
  /** Položkový rozpis investice (PDF kalkulačka) */
  legalFee: number | null;
  appraisalFee: number | null;
  sourcingFee: number | null;
  renovationCost: number | null;
  noiAnnual: number | null;
  cashOnCash: number | null;
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

/** Čísla spolupráce (50/50 vs. sourcing fee) z flip snapshotu.
 *  Nové snapshoty mají blok `cooperation`; staré se odvodí z netProfit a fee. */
export function flipCooperationFromSnapshot(s: CalcSnapshotFlip | null): CooperationView | null {
  if (!s) return null;
  const coop = s.cooperation;
  if (coop) {
    return {
      availableStrategies: strategiesFromAvailability(coop.availability),
      netProfitTotal: coop.netProfitTotal ?? null,
      investorProfitFiftyFifty:
        coop.investorProfitFiftyFifty ??
        (coop.netProfitTotal != null ? Math.round(coop.netProfitTotal / 2) : null),
      investorProfitSourcing:
        coop.investorProfitSourcing ??
        (coop.netProfitTotal != null ? Math.round(coop.netProfitTotal - (coop.sourcingFee ?? 0)) : null),
      sourcingFee: coop.sourcingFee ?? null,
    };
  }
  const fee = s.sourcingFee ?? 0;
  const netProfitTotal = s.netProfit != null ? s.netProfit + fee : null;
  return {
    availableStrategies: strategiesFromAvailability("both"),
    netProfitTotal,
    investorProfitFiftyFifty: netProfitTotal != null ? Math.round(netProfitTotal / 2) : null,
    investorProfitSourcing: s.netProfit ?? null,
    sourcingFee: s.sourcingFee ?? null,
  };
}

/** Iniciály jména pro anonymizované zobrazení ostatním investorům:
 *  „Galja Sabrieva" → „G.S.", jednoslovné „Petr" → „P." */
export function investorInitials(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return `${parts[0][0]}.`.toUpperCase();
  return `${parts[0][0]}.${parts[parts.length - 1][0]}.`.toUpperCase();
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
  /** Způsob spolupráce u flipu (dostupné strategie + čísla). Rental = null. */
  cooperation: CooperationView | null;
  status: PortalStatus;
  reservedByMe: boolean;
  reservedByName: string | null;
  reservedModel?: string | null;
  /** Konec rezervační lhůty (unix ms) u položek rezervovaných mnou. */
  reservationExpiresAt?: number | null;
  overBudget: boolean;
}

export interface PortalRow {
  leadId: string;
  portalStatus: string | null;
  reservedById: string | null;
  reservedByName: string | null;
  portalExpiresAt?: number | null;
  portalReservedModel?: string | null;
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
  const reservedByMe = row.reservedById === investorId;
  const reserved = row.portalStatus === "reserved";
  const snapshot = parseCalcSnapshot(row.calcSnapshot);

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
    snapshot,
    cooperation: calcMode === "flip" ? flipCooperationFromSnapshot(snapshot && snapshot.mode === "flip" ? snapshot : null) : null,
    status: reserved ? "reserved" : "available",
    reservedByMe,
    reservedByName: reserved ? investorInitials(row.reservedByName) : null,
    reservedModel: reserved ? row.portalReservedModel : null,
    reservationExpiresAt: reservedByMe ? row.portalExpiresAt : null,
    overBudget,
  };
}