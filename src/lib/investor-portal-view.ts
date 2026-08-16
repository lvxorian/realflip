import { conditionLabel, buildingTypeLabel, safeJsonParse } from "@/lib/utils";
import { cityDisplayName } from "@/lib/analysis/location";
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
  /** Investice, kterou u 50/50 financuje investor (náklady bez sourcing fee). */
  fundingFiftyFifty: number | null;
  /** Investice, kterou financuje investor při sourcing fee (náklady vč. fee). */
  fundingSourcing: number | null;
  /** ROI investora (jeho zisk / jeho investice) — 50/50 a sourcing fee. */
  investorRoiFiftyFifty: number | null;
  investorRoiSourcing: number | null;
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
 *  Nové snapshoty mají blok `cooperation`; staré se odvodí z netProfit a fee.
 *  Investice investora: 50/50 financuje náklady bez sourcing fee (fee se
 *  v tomto režimu neúčtuje), sourcing fee platí náklady včetně poplatku. */
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
      fundingFiftyFifty:
        coop.netProfitTotal != null && s.totalCost != null
          ? s.totalCost - (coop.sourcingFee ?? 0)
          : null,
      fundingSourcing: coop.netProfitTotal != null ? (s.totalCost ?? null) : null,
      investorRoiFiftyFifty: investorRoi(
        coop.investorProfitFiftyFifty ?? (coop.netProfitTotal != null ? Math.round(coop.netProfitTotal / 2) : null),
        coop.netProfitTotal != null && s.totalCost != null ? s.totalCost - (coop.sourcingFee ?? 0) : null
      ),
      investorRoiSourcing: investorRoi(
        coop.investorProfitSourcing ?? (coop.netProfitTotal != null ? Math.round(coop.netProfitTotal - (coop.sourcingFee ?? 0)) : null),
        coop.netProfitTotal != null ? (s.totalCost ?? null) : null
      ),
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
    fundingFiftyFifty: netProfitTotal != null && s.totalCost != null ? s.totalCost - fee : null,
    fundingSourcing: netProfitTotal != null ? (s.totalCost ?? null) : null,
    investorRoiFiftyFifty: investorRoi(
      netProfitTotal != null ? Math.round(netProfitTotal / 2) : null,
      netProfitTotal != null && s.totalCost != null ? s.totalCost - fee : null
    ),
    investorRoiSourcing: investorRoi(
      s.netProfit ?? null,
      netProfitTotal != null ? s.totalCost : null
    ),
  };
}

function investorRoi(profit: number | null, funding: number | null): number | null {
  if (profit == null || funding == null || funding <= 0) return null;
  return Math.round((profit / funding) * 1000) / 10;
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

/** Potvrzená vyjednaná cena z leadu (fáze Vyjednáno) — null, když není zadaná. */
export function negotiationAmountOf(stageData: StageData | null): number | null {
  const negotiation = stageData?.negotiation;
  if (negotiation && typeof negotiation.currentAmount === "number" && negotiation.currentAmount > 0) {
    return Math.round(negotiation.currentAmount);
  }
  return null;
}

/** Přepočet čísel spolupráce (flip) na zadanou kupní cenu.
 *  basePrice = cena, ze které počítal snapshot (purchasePriceUsed);
 *  atPrice = vyjednaná/zobrazená cena. Zisk roste, když vyjednáno níž.
 *  Beze změny ceny vrací vstup beze změny; fondy i ROI se posunou o rozdíl cen. */
export function shiftFlipAtPrice(
  coop: CooperationView,
  atPrice: number,
  basePrice: number | null
): CooperationView {
  if (basePrice == null || coop.netProfitTotal == null) return coop;
  const delta = basePrice - atPrice;
  if (delta === 0) return coop;
  const total = coop.netProfitTotal + delta;
  const profitFifty = Math.round(total / 2);
  const profitSourcing = total - (coop.sourcingFee ?? 0);
  const fundingFiftyFifty =
    coop.fundingFiftyFifty != null ? coop.fundingFiftyFifty - delta : null;
  const fundingSourcing =
    coop.fundingSourcing != null ? coop.fundingSourcing - delta : null;
  return {
    ...coop,
    netProfitTotal: total,
    investorProfitFiftyFifty: profitFifty,
    investorProfitSourcing: profitSourcing,
    fundingFiftyFifty,
    fundingSourcing,
    investorRoiFiftyFifty: investorRoi(profitFifty, fundingFiftyFifty),
    investorRoiSourcing: investorRoi(profitSourcing, fundingSourcing),
  };
}

/** Přepočet flip výnosu (zisk/ROI) na zadanou kupní cenu při známé bázi snapshotu. */
export function shiftFlipDealAtPrice(deal: FlipDealView, snapshot: CalcSnapshotFlip, atPrice: number): FlipDealView {
  const basePrice = snapshot.purchasePriceUsed;
  if (basePrice == null || deal.type !== "flip") return deal;
  const delta = basePrice - atPrice;
  if (delta === 0) return deal;
  const netProfit = deal.netProfit != null ? deal.netProfit + delta : deal.netProfit;
  const totalCost = snapshot.totalCost;
  const newTotalCost = totalCost != null ? totalCost - delta : null;
  const roi =
    netProfit != null && newTotalCost != null && newTotalCost > 0
      ? Math.round((netProfit / newTotalCost) * 1000) / 10
      : deal.roi;
  const annualizedRoi =
    deal.annualizedRoi != null && deal.roi != null && roi != null && deal.roi !== 0
      ? Math.round(((deal.annualizedRoi * roi) / deal.roi) * 10) / 10
      : deal.annualizedRoi;
  const cashOnCash =
    netProfit != null && newTotalCost != null && newTotalCost > 0
      ? Math.round((netProfit / newTotalCost) * 1000) / 10
      : deal.cashOnCash;
  return { ...deal, netProfit, roi, annualizedRoi, cashOnCash };
}

export interface InvestorPortalItem {
  id: string;
  district: string | null;
  city: string | null;
  condition: string;
  buildingType: string;
  area: number | null;
  rooms: string | null;
  floor: number | null;
  originalPrice: number | null;
  offerPrice: number | null;
  savingsPct: number | null;
  /** Fotky nemovitosti (veřejné pro přihlášeného investora). */
  photos: string[];
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
  buildingType: string | null;
  area: number | null;
  rooms: string | null;
  floor: number | null;
  originalPrice: number | null;
  stageData: unknown;
  imageUrls: string | null;
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
  const flipSnapshot = snapshot && snapshot.mode === "flip" ? snapshot : null;

  const deal = dealFromColumns(row, calcMode);
  const cooperation: CooperationView | null = calcMode === "flip" ? flipCooperationFromSnapshot(flipSnapshot) : null;

  // Čísla musí souznít s cenou, kterou investor vidí: při odlišné vyjednané
  // ceně se zisk/ROI přepočítají z té ceny (báze = cena v snapshotu).
  let finalDeal = deal;
  let finalCooperation = cooperation;
  if (calcMode === "flip" && offerPrice != null && flipSnapshot && deal.type === "flip" && cooperation) {
    finalCooperation = shiftFlipAtPrice(cooperation, offerPrice, flipSnapshot.purchasePriceUsed);
    if (finalCooperation !== cooperation) {
      finalDeal = shiftFlipDealAtPrice(deal, flipSnapshot, offerPrice);
    }
  }

  return {
    id: row.leadId,
    district: row.district,
    city: cityDisplayName(row.city) ?? row.city,
    condition: conditionLabel(row.condition),
    buildingType: buildingTypeLabel(row.buildingType),
    area: row.area,
    rooms: row.rooms,
    floor: row.floor,
    originalPrice: row.originalPrice,
    offerPrice,
    savingsPct,
    photos: safeJsonParse<string[]>(row.imageUrls, []),
    calcMode,
    deal: finalDeal,
    renovationCost: row.renovationCost,
    snapshot,
    cooperation: finalCooperation,
    status: reserved ? "reserved" : "available",
    reservedByMe,
    reservedByName: reserved ? investorInitials(row.reservedByName) : null,
    reservedModel: reserved ? row.portalReservedModel : null,
    reservationExpiresAt: reservedByMe ? row.portalExpiresAt : null,
    overBudget,
  };
}