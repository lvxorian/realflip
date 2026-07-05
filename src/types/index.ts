export type PropertyCondition = "new" | "renovated" | "good" | "original" | "dilapidated";

export type PropertyStatus = "active" | "sold" | "removed";

export type LeadStage = "new" | "contacted" | "meeting" | "offer" | "negotiation" | "won" | "lost";

export type DealStatus = "purchased" | "renovating" | "selling" | "sold";

export type CallOutcome = "no_answer" | "callback" | "not_interested" | "interested" | "meeting_scheduled";

export type ContactType = "owner" | "agent" | "developer";

export type PortalName =
  | "sreality"
  | "bezrealitky"
  | "bazos"
  | "annonce"
  | "reality-cz"
  | "hyperreality"
  | "remax"
  | "century21"
  | "idnes-reality"
  | "mmreality";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PricePoint {
  price: number;
  date: string;
}

export interface RenovationItem {
  category: string;
  planned: number;
  actual: number | null;
  notes: string | null;
}

export interface AlertCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
  value: string | number;
}

export interface RawListing {
  portalId: string;
  portalName: PortalName;
  url: string;
  title: string;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  rooms: string | null;
  floor: number | null;
  condition: string | null;
  yearBuilt: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  contactPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  description: string | null;
  imageUrls: string[];
  publishedAt: Date | null;
  updatedAt: Date | null;
}

export interface NormalizedListing extends RawListing {
  normalizedRooms: string;
  normalizedCondition: PropertyCondition;
  normalizedPricePerSqm: number;
  geoPoint: GeoPoint | null;
}

export interface InvestmentAnalysis {
  marketValue: number;
  undervaluationPct: number;
  investmentScore: number;
  arv: number;
  renovationCost: number;
  totalCost: number;
  netProfit: number;
  roi: number;
  annualizedRoi: number;
  cashOnCash: number;
  breakEvenPrice: number;
  recommendation: "buy" | "consider" | "skip";
}

export interface AiReport {
  summary: string;
  sentiment: "urgent" | "neutral" | "slow";
  maxBid: number;
  negotiationTips: string[];
  redFlags: string[];
  hiddenInfo: string[];
  comparableNotes: string;
}
