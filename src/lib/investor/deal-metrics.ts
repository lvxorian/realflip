import {
  calculateFlipCosts,
  calculateFlipResults,
  type FlipCostConfig,
} from "@/lib/analysis/flip-costs";
import {
  calculateRentalResults,
  estimateMonthlyRent,
  type RentalConfig,
} from "@/lib/analysis/rental-calc";

export interface FlipDealInput {
  price: number;
  arv: number | null;
  renovationCost?: number | null;
  area?: number | null;
  targetRoi?: number;
  config?: Partial<FlipCostConfig>;
}

export interface FlipDealResult {
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  arv: number | null;
}

export interface RentalDealInput {
  price: number;
  monthlyRent?: number | null;
  area?: number | null;
  renovationCost?: number;
  cityKey?: string | null;
  locationCategory?: string | null;
  config?: Partial<RentalConfig>;
}

export interface RentalDealResult {
  netYield: number | null;
  grossYield: number | null;
  capRate: number | null;
  cashFlowMonthly: number | null;
  netYieldAfterTax: number | null;
}

export function computeFlipDeal(input: FlipDealInput): FlipDealResult {
  if (!input || input.price <= 0 || !input.arv || input.arv <= 0) {
    return { netProfit: null, roi: null, annualizedRoi: null, arv: input?.arv ?? null };
  }
  const renovationCost = input.renovationCost ?? 0;
  const area = input.area ?? 0;
  const res = calculateFlipResults(
    Math.round(input.price),
    Math.round(input.arv),
    Math.round(renovationCost),
    area,
    input.targetRoi ?? 15,
    input.config
  );
  return {
    netProfit: res.netProfit,
    roi: res.roi,
    annualizedRoi: res.annualizedRoi,
    arv: Math.round(input.arv),
  };
}

export function computeRentalDeal(input: RentalDealInput): RentalDealResult {
  if (!input || input.price <= 0) {
    return { netYield: null, grossYield: null, capRate: null, cashFlowMonthly: null, netYieldAfterTax: null };
  }
  const area = input.area ?? 0;
  const monthlyRent =
    input.monthlyRent && input.monthlyRent > 0
      ? input.monthlyRent
      : estimateMonthlyRent(area, input.cityKey, input.locationCategory);
  const config: Partial<RentalConfig> = { ...(input.config ?? {}), monthlyRent };
  if (config.targetYield == null) config.targetYield = 0;
  const res = calculateRentalResults(Math.round(input.price), area, input.renovationCost ?? 0, config);
  return {
    netYield: res.netYield,
    grossYield: res.grossYield,
    capRate: res.capRate,
    cashFlowMonthly: res.cashFlowMonthly,
    netYieldAfterTax: res.netYieldAfterTax,
  };
}

export function costsBreakdownForDeal(
  price: number,
  arv: number | null,
  renovationCost: number | null,
  area: number | null,
  config?: Partial<FlipCostConfig>
): { purchasePrice: number; legalFees: number; renovationCost: number; contingency: number; holdingCosts: number; sellingCommission: number; incomeTax: number; totalCost: number } | null {
  if (price <= 0 || !arv || arv <= 0) return null;
  const costs = calculateFlipCosts(Math.round(price), Math.round(arv), Math.round(renovationCost ?? 0), area ?? 0, config);
  return {
    purchasePrice: costs.purchasePrice,
    legalFees: costs.legalFees,
    renovationCost: costs.renovationCost,
    contingency: costs.contingency,
    holdingCosts: costs.holdingCosts,
    sellingCommission: costs.sellingCommission,
    incomeTax: costs.incomeTax,
    totalCost: costs.totalCost,
  };
}