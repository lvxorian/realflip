import { rentPerSqm } from "./market-data";

export interface RentalConfig {
  monthlyRent: number;
  vacancyPct: number;
  managementPct: number;
  repairsPct: number;
  insuranceAnnual: number;
  propertyTaxAnnual: number;
  rentGrowthPct: number;
  appreciationPct: number;
  holdingYears: number;
  targetYield: number;
  legalFee: number;
  appraisal: boolean;
  sourcingEnabled: boolean;
  sourcingFee: number;
  sourcingFeeIsPct: boolean;
  renovationBeforeRent: boolean;
  hasMortgage: boolean;
  mortgageAmount: number;
  mortgageRate: number;
  mortgageTermYears: number;
}

export const RENTAL_CONSTANTS = {
  sellingCommissionRate: 0.05,
  incomeTaxRate: 0.21,
  appraisalFee: 5000,
  taxExemptionYears: 10,
};

export const RENTAL_DEFAULTS: RentalConfig = {
  monthlyRent: 0,
  vacancyPct: 5,
  managementPct: 5,
  repairsPct: 8,
  insuranceAnnual: 4000,
  propertyTaxAnnual: 3000,
  rentGrowthPct: 2,
  appreciationPct: 3,
  holdingYears: 10,
  targetYield: 6,
  legalFee: 25000,
  appraisal: false,
  sourcingEnabled: false,
  sourcingFee: 0,
  sourcingFeeIsPct: false,
  renovationBeforeRent: false,
  hasMortgage: false,
  mortgageAmount: 0,
  mortgageRate: 5,
  mortgageTermYears: 30,
};

export type RentalVerdictLevel = "rentalStrongBuy" | "rentalBuy" | "rentalConsider" | "rentalDontBuy";

export function rentalVerdict(netYield: number): { level: RentalVerdictLevel; label: string } {
  if (netYield >= 6) return { level: "rentalStrongBuy", label: "Výnosový kandidát" };
  if (netYield >= 4.5) return { level: "rentalBuy", label: "Doporučeno k pronájmu" };
  if (netYield >= 3) return { level: "rentalConsider", label: "Zvážit výnos" };
  return { level: "rentalDontBuy", label: "Slabý výnos" };
}

export interface RentalYearRow {
  year: number;
  grossRent: number;
  effectiveRent: number;
  operatingCosts: number;
  noi: number;
  mortgagePayment: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  mortgageBalance: number;
}

export interface RentalResults {
  grossRentAnnual: number;
  effectiveRentAnnual: number;
  operatingCostsAnnual: number;
  noiAnnual: number;
  mortgageAnnual: number;
  cashFlowAnnual: number;
  cashFlowMonthly: number;
  grossYield: number;
  netYield: number;
  capRate: number;
  cashOnCash: number;
  paybackYears: number | null;
  acquisitionCosts: number;
  downPayment: number;
  totalInvested: number;
  breakEvenRent: number;
  targetPurchasePrice: number;
  priceReductionNeeded: number;
  priceReductionPct: number;
  exitPrice: number;
  mortgageBalance: number;
  equity: number;
  exitTax: number;
  netExit: number;
  cumulativeCashFlow: number;
  totalProfit: number;
  totalRoi: number;
  annualizedRoi: number;
  equityMultiple: number;
  verdict: { level: RentalVerdictLevel; label: string };
  rows: RentalYearRow[];
}

function monthlyPayment(principal: number, annualRatePct: number, termYears: number): number {
  if (principal <= 0) return 0;
  if (annualRatePct <= 0) return termYears > 0 ? principal / (termYears * 12) : 0;
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function remainingBalance(principal: number, annualRatePct: number, termYears: number, monthsElapsed: number): number {
  if (principal <= 0) return 0;
  if (monthsElapsed <= 0) return principal;
  if (annualRatePct <= 0) return Math.max(0, principal * (1 - monthsElapsed / (termYears * 12)));
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (monthsElapsed >= n) return 0;
  const pmt = monthlyPayment(principal, annualRatePct, termYears);
  return (pmt * (1 - Math.pow(1 + r, -(n - monthsElapsed)))) / r;
}

export function resolveSourcingFee(purchasePrice: number, cfg: Pick<RentalConfig, "sourcingEnabled" | "sourcingFee" | "sourcingFeeIsPct">): number {
  if (!cfg.sourcingEnabled) return 0;
  return cfg.sourcingFeeIsPct ? Math.round(purchasePrice * (cfg.sourcingFee / 100)) : cfg.sourcingFee;
}

export function calculateRentalResults(
  purchasePrice: number,
  area: number,
  renovationCost: number,
  config?: Partial<RentalConfig>
): RentalResults {
  const cfg: RentalConfig = { ...RENTAL_DEFAULTS, ...config };
  const c = RENTAL_CONSTANTS;

  const vacancyFactor = 1 - cfg.vacancyPct / 100;
  const pctOpex = (cfg.managementPct + cfg.repairsPct) / 100;

  const annualGrossRent = cfg.monthlyRent * 12;
  const effectiveRentAnnual = annualGrossRent * vacancyFactor;
  const operatingCostsAnnual = Math.round(
    effectiveRentAnnual * pctOpex + cfg.insuranceAnnual + cfg.propertyTaxAnnual
  );
  const noiAnnual = effectiveRentAnnual - operatingCostsAnnual;

  const sourcingFee = resolveSourcingFee(purchasePrice, cfg);
  const acquisitionCosts = cfg.legalFee + (cfg.appraisal ? c.appraisalFee : 0) + sourcingFee + (cfg.renovationBeforeRent ? renovationCost : 0);
  const loan = cfg.hasMortgage ? Math.max(0, Math.min(cfg.mortgageAmount, purchasePrice)) : 0;
  const downPayment = purchasePrice - loan;
  const totalInvested = downPayment + acquisitionCosts;

  const pmtMonthly = monthlyPayment(loan, cfg.mortgageRate, cfg.mortgageTermYears);
  const mortgageAnnual = pmtMonthly * 12;
  const cashFlowAnnual = noiAnnual - mortgageAnnual;

  const grossYield = purchasePrice > 0 ? (annualGrossRent / purchasePrice) * 100 : 0;
  const netYield = purchasePrice > 0 ? (noiAnnual / purchasePrice) * 100 : 0;
  const capRate = purchasePrice + acquisitionCosts > 0 ? (noiAnnual / (purchasePrice + acquisitionCosts)) * 100 : 0;
  const cashOnCash = totalInvested > 0 ? (cashFlowAnnual / totalInvested) * 100 : 0;
  const paybackYears = cashFlowAnnual > 0 ? totalInvested / cashFlowAnnual : null;

  const breakEvenRent = 1 - pctOpex > 0
    ? (cfg.insuranceAnnual + cfg.propertyTaxAnnual + mortgageAnnual) / (12 * vacancyFactor * (1 - pctOpex))
    : 0;

  const targetPurchasePrice = cfg.targetYield > 0 ? noiAnnual / (cfg.targetYield / 100) : 0;
  const priceReductionNeeded = Math.max(0, purchasePrice - targetPurchasePrice);
  const priceReductionPct = purchasePrice > 0
    ? Math.round((priceReductionNeeded / purchasePrice) * 100 * 10) / 10
    : 0;

  const years = Math.max(1, cfg.holdingYears);
  const months = Math.round(years * 12);

  const rows: RentalYearRow[] = [];
  let cumulativeCashFlow = 0;
  for (let y = 1; y <= years; y++) {
    const growth = Math.pow(1 + cfg.rentGrowthPct / 100, y - 1);
    const grossRent = Math.round(annualGrossRent * growth);
    const effectiveRent = Math.round(grossRent * vacancyFactor);
    const operatingCosts = Math.round(effectiveRent * pctOpex + cfg.insuranceAnnual + cfg.propertyTaxAnnual);
    const noi = effectiveRent - operatingCosts;
    const cashFlow = noi - mortgageAnnual;
    cumulativeCashFlow += cashFlow;
    rows.push({
      year: y,
      grossRent,
      effectiveRent,
      operatingCosts,
      noi,
      mortgagePayment: Math.round(mortgageAnnual),
      cashFlow,
      cumulativeCashFlow,
      mortgageBalance: Math.round(remainingBalance(loan, cfg.mortgageRate, cfg.mortgageTermYears, y * 12)),
    });
  }

  const exitPrice = purchasePrice * Math.pow(1 + cfg.appreciationPct / 100, years);
  const sellingCost = Math.round(exitPrice * c.sellingCommissionRate);
  const mortgageBalance = remainingBalance(loan, cfg.mortgageRate, cfg.mortgageTermYears, months);
  const equity = exitPrice - sellingCost - mortgageBalance;
  const gain = exitPrice - sellingCost - purchasePrice - acquisitionCosts;
  const exitTax = years < c.taxExemptionYears && gain > 0 ? Math.round(gain * c.incomeTaxRate) : 0;
  const netExit = equity - exitTax;

  const totalProfit = cumulativeCashFlow + netExit - totalInvested;
  const totalRoi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  return {
    grossRentAnnual: Math.round(annualGrossRent),
    effectiveRentAnnual: Math.round(effectiveRentAnnual),
    operatingCostsAnnual,
    noiAnnual,
    mortgageAnnual: Math.round(mortgageAnnual),
    cashFlowAnnual,
    cashFlowMonthly: Math.round(cashFlowAnnual / 12),
    grossYield: Math.round(grossYield * 10) / 10,
    netYield: Math.round(netYield * 10) / 10,
    capRate: Math.round(capRate * 10) / 10,
    cashOnCash: Math.round(cashOnCash * 10) / 10,
    paybackYears: paybackYears !== null ? Math.round(paybackYears * 10) / 10 : null,
    acquisitionCosts,
    downPayment: Math.round(downPayment),
    totalInvested: Math.round(totalInvested),
    breakEvenRent: Math.round(breakEvenRent),
    targetPurchasePrice: Math.round(targetPurchasePrice),
    priceReductionNeeded: Math.round(priceReductionNeeded),
    priceReductionPct,
    exitPrice: Math.round(exitPrice),
    mortgageBalance: Math.round(mortgageBalance),
    equity: Math.round(equity),
    exitTax,
    netExit,
    cumulativeCashFlow: Math.round(cumulativeCashFlow),
    totalProfit: Math.round(totalProfit),
    totalRoi: Math.round(totalRoi * 10) / 10,
    annualizedRoi: Math.round((totalRoi / years) * 10) / 10,
    equityMultiple: Math.round((totalProfit / totalInvested + 1) * 10) / 10,
    verdict: rentalVerdict(netYield),
    rows,
  };
}

export function estimateMonthlyRent(
  area: number,
  city?: string | null,
  category?: string | null
): number {
  if (area <= 0) return 0;
  return Math.round(area * rentPerSqm(city, category));
}
