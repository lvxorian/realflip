import { DetailedCosts, RenovationItem } from "./types";

export const COST_CONSTANTS = {
  commissionRate: 0.04,
  sellingCommissionRate: 0.04,
  legalFees: 25000,
  appraisalFee: 8000,
  homeStaging: 35000,
  certificates: 10000,
  taxRate: 0.15,
  holdingCostMonthlyRate: 0.005,
  holdingPeriodMonths: 6,
};

export const RENOVATION_PRESETS = {
  light: { label: "Lehká", costPerSqm: 4500, months: 3, description: "Malba, podlahy, drobné opravy" },
  medium: { label: "Střední", costPerSqm: 10000, months: 5, description: "Koupelna, kuchyně, elektrika, voda" },
  full: { label: "Těžká", costPerSqm: 18000, months: 8, description: "Generální rekonstrukce vč. rozvodů" },
};

export function calculateTargetPurchasePrice(
  arv: number,
  renovationCost: number,
  targetROI?: number
): number {
  const roi = (targetROI ?? 15) / 100;
  const taxRate = 0.15;
  const grossTargetRatio = roi / (1 - taxRate);
  const targetMultiple = 1 + grossTargetRatio;
  const targetTotalCost = arv / targetMultiple;
  const acqCostRate = 0.04;
  const holdingCostRate = 0.005 * 6;
  const fixedAcqCosts = 33000;
  const sellingCosts = Math.round(arv * 0.04) + 45000;
  const totalCostNoRenov = 1 + acqCostRate + holdingCostRate * (1 + acqCostRate);
  return Math.round(
    (targetTotalCost - (1 + holdingCostRate) * renovationCost - sellingCosts - fixedAcqCosts * (1 + holdingCostRate)) / totalCostNoRenov
  );
}

export function calculateFlipCosts(
  purchasePrice: number,
  arv: number,
  renovationCost: number,
  holdingMonths?: number
): DetailedCosts {
  const c = COST_CONSTANTS;
  const months = holdingMonths ?? c.holdingPeriodMonths;

  const commission = Math.round(purchasePrice * c.commissionRate);
  const legalFees = c.legalFees;
  const appraisalFee = c.appraisalFee;
  const holdingCosts = Math.round((purchasePrice + renovationCost) * c.holdingCostMonthlyRate * months);
  const sellingCommission = Math.round(arv * c.sellingCommissionRate);
  const homeStaging = c.homeStaging;
  const certs = c.certificates;

  const grossProfit = arv - purchasePrice - commission - legalFees - appraisalFee - renovationCost - holdingCosts - sellingCommission - homeStaging - certs;
  const incomeTax = grossProfit > 0 ? Math.round(grossProfit * c.taxRate) : 0;

  const totalCost =
    purchasePrice +
    commission +
    legalFees +
    appraisalFee +
    renovationCost +
    holdingCosts +
    sellingCommission +
    homeStaging +
    certs +
    incomeTax;

  return {
    purchasePrice,
    commission,
    legalFees,
    appraisalFee,
    renovationCost,
    holdingCosts,
    sellingCommission,
    homeStaging,
    certificates: certs,
    incomeTax,
    totalCost,
  };
}

export function calculateFlipResults(
  purchasePrice: number,
  arv: number,
  renovationCost: number,
  targetROI?: number,
  holdingMonths?: number
) {
  const costs = calculateFlipCosts(purchasePrice, arv, renovationCost, holdingMonths);
  const netProfit = arv - costs.totalCost;
  const roi = costs.totalCost > 0 ? (netProfit / costs.totalCost) * 100 : 0;
  const annualizedRoi = holdingMonths
    ? (roi / holdingMonths) * 12
    : (roi / COST_CONSTANTS.holdingPeriodMonths) * 12;
  const cashOnCash = costs.purchasePrice > 0
    ? Math.round((netProfit / costs.purchasePrice) * 100 * 10) / 10
    : 0;

  const targetPrice = calculateTargetPurchasePrice(arv, renovationCost, targetROI);
  const priceReductionNeeded = Math.max(0, purchasePrice - targetPrice);
  const priceReductionPct = purchasePrice > 0
    ? Math.round((priceReductionNeeded / purchasePrice) * 100 * 10) / 10
    : 0;

  return {
    costs,
    netProfit,
    roi: Math.round(roi * 10) / 10,
    annualizedRoi: Math.round(annualizedRoi * 10) / 10,
    cashOnCash,
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
  if (level === "full") {
    const bathroomFixed = 250000;
    const kitchenFixed = 200000;
    return base + bathroomFixed + kitchenFixed;
  }
  if (level === "medium") {
    const bathroomFixed = 180000;
    const kitchenFixed = 140000;
    return base + bathroomFixed + kitchenFixed;
  }
  return base + 80000 + 60000;
}
