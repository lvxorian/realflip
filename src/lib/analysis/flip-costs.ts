import { DetailedCosts, RenovationItem } from "./types";

export const COST_CONSTANTS = {
  sellingCommissionRate: 0.05,
  legalFees: 25000,
  appraisalFee: 5000,
  holdingCostPerSqm: 120,
  marketingPhoto: 20000,
  contingencyRate: 0.10,
  holdingPeriodMonths: 6,
};

export const RENOVATION_PRESETS = {
  light: { label: "Lehká", costPerSqm: 4500, months: 3, description: "Malba, podlahy, drobné opravy" },
  medium: { label: "Střední", costPerSqm: 10000, months: 5, description: "Koupelna, kuchyně, elektrika, voda" },
  full: { label: "Těžká", costPerSqm: 18000, months: 8, description: "Generální rekonstrukce vč. rozvodů" },
};

export interface FlipCostConfig {
  sellCommission: boolean;
  appraisal: boolean;
  sourcingFee: number;
  sourcingFeeIsPct: boolean;
  holdingMonths: number;
  hasMortgage: boolean;
  mortgageAmount: number;
  mortgageRate: number;
  taxRate: number;
  isVatPayer: boolean;
}

const DEFAULT_CONFIG: FlipCostConfig = {
  sellCommission: true,
  appraisal: false,
  sourcingFee: 0,
  sourcingFeeIsPct: false,
  holdingMonths: 6,
  hasMortgage: false,
  mortgageAmount: 0,
  mortgageRate: 0,
  taxRate: 21,
  isVatPayer: false,
};

function calculateRawROI(
  purchasePrice: number,
  arv: number,
  renovationCost: number,
  area: number,
  config?: Partial<FlipCostConfig>
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const c = COST_CONSTANTS;
  const months = cfg.holdingMonths ?? c.holdingPeriodMonths;
  const contingency = Math.round(renovationCost * c.contingencyRate);
  const legalFees = c.legalFees;
  const appraisalFee = cfg.appraisal ? c.appraisalFee : 0;
  const holding = months * area * c.holdingCostPerSqm;
  const mortgageCost = cfg.hasMortgage && cfg.mortgageAmount > 0
    ? Math.round(cfg.mortgageAmount * (cfg.mortgageRate / 100 / 12) * months)
    : 0;
  const sellingCommission = cfg.sellCommission ? Math.round(arv * c.sellingCommissionRate) : 0;
  const marketingPhoto = cfg.sellCommission ? 0 : c.marketingPhoto;
  const sourcingFee = cfg.sourcingFeeIsPct ? Math.round(purchasePrice * (cfg.sourcingFee / 100)) : cfg.sourcingFee;
  const vatDeduction = cfg.isVatPayer ? Math.round(renovationCost * 21 / 121) : 0;

  const subTotal = purchasePrice + legalFees + appraisalFee + renovationCost + contingency + holding + mortgageCost + sellingCommission + marketingPhoto + sourcingFee;
  const grossProfit = arv - subTotal;
  const incomeTax = grossProfit > 0 ? Math.round(grossProfit * (cfg.taxRate / 100)) : 0;
  const totalCost = subTotal + incomeTax - vatDeduction;
  const netProfit = arv - totalCost;
  return totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
}

export function calculateTargetPurchasePrice(
  arv: number,
  renovationCost: number,
  area: number,
  targetROI?: number,
  config?: Partial<FlipCostConfig>
): number {
  const target = targetROI ?? 15;
  let lo = 0;
  let hi = arv;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const roi = calculateRawROI(mid, arv, renovationCost, area, config);
    if (roi < target) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

export function calculateFlipCosts(
  purchasePrice: number,
  arv: number,
  renovationCost: number,
  area: number,
  config?: Partial<FlipCostConfig>
): DetailedCosts {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const c = COST_CONSTANTS;
  const months = cfg.holdingMonths ?? c.holdingPeriodMonths;
  const contingency = Math.round(renovationCost * c.contingencyRate);
  const legalFees = c.legalFees;
  const appraisalFee = cfg.appraisal ? c.appraisalFee : 0;
  const holding = months * area * c.holdingCostPerSqm;
  const mortgageCost = cfg.hasMortgage && cfg.mortgageAmount > 0
    ? Math.round(cfg.mortgageAmount * (cfg.mortgageRate / 100 / 12) * months)
    : 0;
  const sellingCommission = cfg.sellCommission ? Math.round(arv * c.sellingCommissionRate) : 0;
  const marketingPhoto = cfg.sellCommission ? 0 : c.marketingPhoto;
  const sourcingFee = cfg.sourcingFeeIsPct ? Math.round(purchasePrice * (cfg.sourcingFee / 100)) : cfg.sourcingFee;
  const vatDeduction = cfg.isVatPayer ? Math.round(renovationCost * 21 / 121) : 0;

  const subTotal = purchasePrice + legalFees + appraisalFee + renovationCost + contingency + holding + mortgageCost + sellingCommission + marketingPhoto + sourcingFee;
  const grossProfit = arv - subTotal;
  const incomeTax = grossProfit > 0 ? Math.round(grossProfit * (cfg.taxRate / 100)) : 0;
  const totalCost = subTotal + incomeTax - vatDeduction;

  return {
    purchasePrice,
    legalFees,
    appraisalFee,
    renovationCost,
    contingency,
    holdingCosts: holding,
    mortgageCost,
    sellingCommission,
    marketingPhoto,
    sourcingFee,
    incomeTax,
    vatDeduction,
    totalCost,
  };
}

export function calculateFlipResults(
  purchasePrice: number,
  arv: number,
  renovationCost: number,
  area: number,
  targetROI?: number,
  config?: Partial<FlipCostConfig>
) {
  const costs = calculateFlipCosts(purchasePrice, arv, renovationCost, area, config);
  const netProfit = arv - costs.totalCost;
  const roi = costs.totalCost > 0 ? (netProfit / costs.totalCost) * 100 : 0;
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const months = cfg.holdingMonths ?? COST_CONSTANTS.holdingPeriodMonths;
  const annualizedRoi = (roi / months) * 12;

  const targetPrice = calculateTargetPurchasePrice(arv, renovationCost, area, targetROI, config);
  const priceReductionNeeded = Math.max(0, purchasePrice - targetPrice);
  const priceReductionPct = purchasePrice > 0
    ? Math.round((priceReductionNeeded / purchasePrice) * 100 * 10) / 10
    : 0;

  return {
    costs,
    netProfit,
    roi: Math.round(roi * 10) / 10,
    annualizedRoi: Math.round(annualizedRoi * 10) / 10,
    cashOnCash: costs.purchasePrice > 0
      ? Math.round((netProfit / costs.purchasePrice) * 100 * 10) / 10
      : 0,
    targetPurchasePrice: targetPrice,
    priceReductionNeeded,
    priceReductionPct,
  };
}

export function calculateItemizedRenovation(area: number, condition: string | null): RenovationItem[] {
  const needsFull = condition === "original" || condition === "dilapidated";
  const needsMedium = condition === "good" || !condition;
  const needsLight = condition === "new" || condition === "renovated";

  const items: RenovationItem[] = [];
  items.push({ category: "Bourání a přípravné práce", estimatedCost: Math.round(area * (needsFull ? 600 : 300)), note: needsFull ? "Plné bourání" : "Částečné úpravy" });
  items.push({ category: "Elektroinstalace", estimatedCost: Math.round(area * (needsFull ? 1800 : needsMedium ? 1200 : 400)), note: needsFull ? "Kompletní nová" : needsMedium ? "Částečná" : "Drobné úpravy" });
  items.push({ category: "Vodoinstalace a topení", estimatedCost: Math.round(area * (needsFull ? 2000 : needsMedium ? 1400 : 500)), note: needsFull ? "Kompletní nové" : needsMedium ? "Částečná" : "Drobné úpravy" });
  items.push({ category: "Podlahy", estimatedCost: Math.round(area * (needsFull ? 1500 : needsMedium ? 1000 : 600)), note: needsFull ? "Včetně vyrovnání" : "Přebroušení/položení" });
  items.push({ category: "Malby a omítky", estimatedCost: Math.round(area * (needsFull ? 800 : needsMedium ? 500 : 300)), note: needsFull ? "Nové omítky" : "Přemalování" });
  const bathroomCost = needsFull ? 250000 : needsMedium ? 180000 : 80000;
  items.push({ category: "Koupelna", estimatedCost: bathroomCost, note: needsFull ? "Kompletní rekonstrukce" : "Částečná" });
  const kitchenCost = needsFull ? 200000 : needsMedium ? 140000 : 60000;
  items.push({ category: "Kuchyně", estimatedCost: kitchenCost, note: needsFull ? "Nová kuchyně vč. spotřebičů" : needsMedium ? "Nová linka" : "Drobné úpravy" });
  items.push({ category: "Okna a dveře", estimatedCost: Math.round(area * (needsFull ? 1200 : needsMedium ? 600 : 200)), note: needsFull ? "Nová okna" : needsMedium ? "Částečná výměna" : "Údržba" });
  return items;
}

export function renovationCostFromPreset(area: number, level: "light" | "medium" | "full"): number {
  const preset = RENOVATION_PRESETS[level];
  if (area <= 0) return 0;
  const base = Math.round(area * preset.costPerSqm);
  if (level === "full") return base + 250000 + 200000;
  if (level === "medium") return base + 180000 + 140000;
  return base + 80000 + 60000;
}
