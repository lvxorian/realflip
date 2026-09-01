import { COST_CONSTANTS, calculateFlipCosts } from "@/lib/analysis/flip-costs";

/**
 * Kalkulačka výkupu před dražbou (pre-auction / pre-foreclosure).
 *
 * Model: investor kupuje nemovitost za 70 % tržní ceny v daném stavu
 * (AsIs TMV × (100 − sleva) / 100). Z kupní ceny se uhradí dluhy (TD),
 * transakční náklady (TC) a zbytek (NCO) připadne dlužníkovi.
 *
 * NCO = TBP − TD − TC  →  verdikt realizovatelnosti (must be > 0)
 *
 * Investiční náklady počítáme přes sdílený `calculateFlipCosts` BEZ
 * hypotéky a znaleckého posudku (ty u dražby neřešíme). TC je součástí
 * distribuce TBP, do investorových nákladů se nepřipočítává podruhé.
 */

export const TAX_RATE = 0.21;

export interface AuctionCostConfig {
  sellCommission: boolean;
  sourcingEnabled: boolean;
  sourcingFee: number;
  sourcingFeeIsPct: boolean;
  holdingMonths: number;
}

export const AUCTION_DEFAULTS: AuctionCostConfig = {
  sellCommission: true,
  sourcingEnabled: false,
  sourcingFee: 100_000,
  sourcingFeeIsPct: false,
  holdingMonths: 6,
};

export interface AuctionCalcInput {
  asIsTmv: number;
  td: number;
  tc: number;
  np: number | null;
  arv: number;
  renovationCost: number;
  area: number;
  discount: number;
  config?: Partial<AuctionCostConfig>;
}

export interface AuctionResults {
  tbp: number;
  nco: number;
  feasible: boolean;
  auctionPayout: number;
  negotiationAdvantage: number;
  costs: ReturnType<typeof calculateFlipCosts>;
  netProfit: number;
  roi: number;
  annualizedRoi: number;
  cashOnCash: number;
  ceilingPrice: number;
  breakEvenPrice: number;
  investorProfit: number;
  dealmakerProfit: number;
  sourcingFee: number;
  strategy: "sourcing-fee" | "fifty-fifty";
}

function resolveConfig(config?: Partial<AuctionCostConfig>): AuctionCostConfig {
  return { ...AUCTION_DEFAULTS, ...config };
}

function buildFlipConfig(cfg: AuctionCostConfig) {
  return {
    sellCommission: cfg.sellCommission,
    appraisal: false,
    // vypnutý sourcing = žádný fee v nákladech (stejný gate jako kalkulačka)
    sourcingFee: cfg.sourcingEnabled ? cfg.sourcingFee : 0,
    sourcingFeeIsPct: cfg.sourcingFeeIsPct,
    holdingMonths: cfg.holdingMonths,
    hasMortgage: false,
    mortgageAmount: 0,
    mortgageRate: 0,
  };
}

function costsAtPrice(price: number, input: AuctionCalcInput, cfg: AuctionCostConfig) {
  return calculateFlipCosts(price, input.arv, input.renovationCost, input.area, buildFlipConfig(cfg));
}

function netProfitAtPrice(price: number, input: AuctionCalcInput, cfg: AuctionCostConfig) {
  return input.arv - costsAtPrice(price, input, cfg).totalCost;
}

function roiAtPrice(price: number, input: AuctionCalcInput, cfg: AuctionCostConfig) {
  const costs = costsAtPrice(price, input, cfg);
  return costs.totalCost > 0 ? ((input.arv - costs.totalCost) / costs.totalCost) * 100 : 0;
}

/** Maximální výkupní cena, při které investor stále dosahuje cílového ROI. */
export function calculateCeilingPrice(
  input: AuctionCalcInput,
  targetRoi = 15
): number {
  const cfg = resolveConfig(input.config);
  if (input.arv <= 0) return 0;
  let lo = 0;
  let hi = input.arv;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (roiAtPrice(mid, input, cfg) < targetRoi) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Break-even: maximální výkupní cena, při které zisk investora neklesne pod 0. */
export function calculateBreakEvenPrice(input: AuctionCalcInput): number {
  const cfg = resolveConfig(input.config);
  if (input.arv <= 0) return 0;
  let lo = 0;
  let hi = input.arv;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netProfitAtPrice(mid, input, cfg) < 0) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

export function calculateAuctionResults(
  input: AuctionCalcInput,
  targetRoi = 15
): AuctionResults {
  const cfg = resolveConfig(input.config);
  const tbp = Math.round((input.asIsTmv * (100 - input.discount)) / 100);
  const nco = tbp - input.td - input.tc;
  const feasible = nco > 0;

  const costs = costsAtPrice(tbp, input, cfg);
  const netProfit = input.arv - costs.totalCost;
  const roi = costs.totalCost > 0 ? (netProfit / costs.totalCost) * 100 : 0;
  const months = cfg.holdingMonths || COST_CONSTANTS.holdingPeriodMonths;
  const annualizedRoi = (roi / months) * 12;
  const cashOnCash = tbp > 0 ? (netProfit / tbp) * 100 : 0;

  // Co by dlužník dostal v dražbě (nejnižší podání minus dluhy) – vyjednávací argument
  const auctionPayout = input.np ? input.np - input.td : 0;
  const negotiationAdvantage = nco - auctionPayout;

  const sourcingFee = cfg.sourcingEnabled
    ? cfg.sourcingFeeIsPct
      ? Math.round((tbp * cfg.sourcingFee) / 100)
      : cfg.sourcingFee
    : 0;

  const strategy: "sourcing-fee" | "fifty-fifty" = cfg.sourcingEnabled
    ? "sourcing-fee"
    : "fifty-fifty";

  const investorProfit = strategy === "sourcing-fee" ? netProfit : Math.round(netProfit / 2);
  const dealmakerProfit =
    strategy === "sourcing-fee" ? sourcingFee : Math.round(netProfit / 2);

  return {
    tbp,
    nco,
    feasible,
    auctionPayout,
    negotiationAdvantage,
    costs,
    netProfit,
    roi: Math.round(roi * 10) / 10,
    annualizedRoi: Math.round(annualizedRoi * 10) / 10,
    cashOnCash: Math.round(cashOnCash * 10) / 10,
    ceilingPrice: calculateCeilingPrice(input, targetRoi),
    breakEvenPrice: calculateBreakEvenPrice(input),
    investorProfit,
    dealmakerProfit,
    sourcingFee,
    strategy,
  };
}
