import { InvestmentAnalysis, PropertyCondition } from "@/types";

interface FlipInput {
  purchasePrice: number;
  area: number;
  condition: PropertyCondition;
  renovationLevel: "light" | "medium" | "full";
  timelineMonths: number;
  marketValue: number;
}

const RENOVATION_COST_PER_SQM: Record<string, Record<string, number>> = {
  light: { new: 2000, renovated: 2000, good: 4000, original: 8000, dilapidated: 10000 },
  medium: { new: 4000, renovated: 4000, good: 8000, original: 12000, dilapidated: 16000 },
  full: { new: 6000, renovated: 6000, good: 12000, original: 18000, dilapidated: 25000 },
};

const DEFAULT_COMMISSION_PCT = 4;
const DEFAULT_TAX_PCT = 4;
const DEFAULT_LEGAL_PCT = 4;
const DEFAULT_BUFFER_PCT = 10;

export function calculateFlip(input: FlipInput): InvestmentAnalysis {
  const {
    purchasePrice,
    area,
    condition,
    renovationLevel,
    timelineMonths,
    marketValue,
  } = input;

  // Renovation cost
  const costPerSqm = RENOVATION_COST_PER_SQM[renovationLevel]?.[condition] || 12000;
  const renovationCost = Math.round(area * costPerSqm);

  // Fees
  const commission = Math.round(purchasePrice * (DEFAULT_COMMISSION_PCT / 100));
  const tax = Math.round(purchasePrice * (DEFAULT_TAX_PCT / 100));
  const legal = Math.round(purchasePrice * (DEFAULT_LEGAL_PCT / 100));
  const buffer = Math.round(renovationCost * (DEFAULT_BUFFER_PCT / 100));

  // Total cost
  const totalCost = purchasePrice + renovationCost + commission + tax + legal + buffer;

  // ARV (After Repair Value) – market value + appreciation for renovation
  const renovationMultiplier = renovationLevel === "full" ? 1.2 : renovationLevel === "medium" ? 1.1 : 1.05;
  const arv = Math.round(marketValue * renovationMultiplier);

  // Profit
  const netProfit = arv - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const annualizedRoi = timelineMonths > 0 ? (roi / timelineMonths) * 12 : 0;
  const cashOnCash = purchasePrice > 0 ? (netProfit / purchasePrice) * 100 : 0;

  // Break-even
  const breakEvenPrice = Math.round(totalCost - netProfit * 0.5);

  // Undervaluation
  const undervaluationPct = marketValue > 0
    ? ((marketValue - purchasePrice) / marketValue) * 100
    : 0;

  // Investment Score (0-100)
  const scoreComponents = {
    undervaluation: Math.min((undervaluationPct / 30) * 40, 40),
    roi: Math.min((roi / 30) * 25, 25),
    timeline: Math.max(0, 15 - timelineMonths),
    condition: condition === "original" || condition === "dilapidated" ? 10 : condition === "good" ? 5 : 0,
    marketConfidence: marketValue > 0 ? 10 : 0,
  };
  const investmentScore = Math.round(
    scoreComponents.undervaluation +
    scoreComponents.roi +
    scoreComponents.timeline +
    scoreComponents.condition +
    scoreComponents.marketConfidence
  );

  // Recommendation
  const recommendation = investmentScore >= 70 ? "buy" : investmentScore >= 40 ? "consider" : "skip";

  return {
    marketValue,
    undervaluationPct: Math.round(undervaluationPct * 10) / 10,
    investmentScore,
    arv,
    renovationCost,
    totalCost,
    netProfit,
    roi: Math.round(roi * 10) / 10,
    annualizedRoi: Math.round(annualizedRoi * 10) / 10,
    cashOnCash: Math.round(cashOnCash * 10) / 10,
    breakEvenPrice,
    recommendation,
  };
}

export function findComparables(
  properties: Array<{
    price: number;
    area: number | null;
    rooms: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  }>,
  targetPrice: number,
  targetArea: number,
  targetLat?: number,
  targetLng?: number
) {
  const areaRange = targetArea * 0.2;
  const priceRange = targetPrice * 0.5;

  return properties.filter((p) => {
    if (p.area && Math.abs(p.area - targetArea) > areaRange) return false;
    if (Math.abs(p.price - targetPrice) > priceRange) return false;
    return true;
  });
}
