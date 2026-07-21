export type LocationCategory = "premium" | "stable" | "risky" | "unknown";
export type VerdictLevel = "strongBuy" | "buy" | "consider" | "dontBuy" | "categoricalReject";
export type OccupancyStatus = "free" | "occupied" | "unknown";
export type BuildingType = "brick" | "panel" | "new" | "mixed" | null;
export type EnergyLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;

export interface PriceRange {
  low: number;
  high: number;
}

export interface CitySegments {
  panel_needs_renov: PriceRange;
  panel_renovated: PriceRange;
  brick_needs_renov: PriceRange;
  brick_renovated: PriceRange;
}

export interface CityMarketData {
  districts: {
    premium: string[];
    stable: string[];
    risky: string[];
  };
  segments: CitySegments;
}

export interface LocationResult {
  city: string;
  district: string | null;
  category: LocationCategory;
  segments: CitySegments | null;
}

export interface RedFlag {
  type: "missing_info" | "euphemism" | "price_warning" | "location_warning" | "occupancy_warning";
  text: string;
  severity: "low" | "medium" | "high";
}

export interface DetailedCosts {
  purchasePrice: number;
  legalFees: number;
  appraisalFee: number;
  renovationCost: number;
  contingency: number;
  holdingCosts: number;
  mortgageCost: number;
  sellingCommission: number;
  marketingPhoto: number;
  sourcingFee: number;
  incomeTax: number;
  vatDeduction: number;
  totalCost: number;
}

export interface RenovationItem {
  category: string;
  estimatedCost: number;
  note: string;
}

export interface ScenarioResult {
  label: string;
  renovationCost: number;
  arv: number;
  totalCost: number;
  netProfit: number;
  roi: number;
  annualizedRoi: number;
}

export interface FullAnalysis {
  condition: string | null;
  pricePerSqm: number;
  missingFields: string[];
  location: LocationResult;
  marketPricePerSqmLow: number;
  marketPricePerSqmHigh: number;
  undervaluationPct: number;
  overpricingPct: number;
  segmentRating: "best" | "good" | "ok" | "niche" | "poor";
  occupancy: OccupancyStatus;
  buildingType: BuildingType;
  energyLabel: EnergyLabel;
  technicalScore: number;
  redFlags: RedFlag[];
  costs: DetailedCosts;
  arv: number;
  netProfit: number;
  roi: number;
  annualizedRoi: number;
  cashOnCash: number;
  breakEvenPrice: number;
  rentalYield: number | null;
  alternativeStrategies: string[];
  investmentScore: number;
  recommendation: "buy" | "consider" | "skip";
  verdictLevel: VerdictLevel;
  verdictSummary: string;

  // Target price for 15% flip margin
  targetPurchasePrice: number;
  priceReductionNeeded: number;
  priceReductionPct: number;
  targetROI: number;

  // Multi-scenario analysis
  scenarios: {
    optimistic: ScenarioResult;
    conservative: ScenarioResult;
    pessimistic: ScenarioResult;
  };

  // Itemized renovation estimate
  renovationItems: RenovationItem[];
}
