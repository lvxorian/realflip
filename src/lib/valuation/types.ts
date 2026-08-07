/**
 * Modul Odhad — typy.
 * Vstup = vlastnosti nemovitosti (z URL nebo ručně), výstup = cenový odhad
 * kombinující realizované prodeje (Seznam cenová mapa), ČSÚ statistiky
 * a nabídkové kompy z vlastní DB.
 */

export type ConfidenceLabel = "Vysoká" | "Střední" | "Nízká";

export interface ValuationInput {
  address?: string | null;
  cityKey: string;
  cityName?: string | null;
  lat?: number | null;
  lng?: number | null;
  type: "flat" | "house" | "land";
  disposition?: string | null;
  area?: number | null;
  floor?: number | null;
  condition?: string | null;
  buildingType?: string | null;
  category?: string | null;
  yearBuilt?: number | null;
  askingPrice?: number | null;
  balcony?: boolean | null;
  garage?: boolean | null;
  sourceUrl?: string | null;
  /** Hinty na městskou čtvrť (z reverse geokódu / adresy) — pro ward-level realizované ceny. Server-only. */
  wardHints?: string[] | null;
}

export interface SourceInfo {
  key: string;
  label: string;
  pricePerSqm: number | null;
  sampleSize: number | null;
  weight: number;
  note: string;
}

export interface ComparableRow {
  label: string;
  area?: number | null;
  price?: number | null;
  pricePerSqm: number;
  distanceKm?: number | null;
  source: "realized" | "offer";
  condition?: string | null;
}

export interface TrendPoint {
  monthYear: string;
  price: number;
}

export interface ValuationResult {
  estimate: number;
  low: number;
  high: number;
  pricePerSqm: number;
  lowPerSqm: number;
  highPerSqm: number;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  sources: SourceInfo[];
  comparables: ComparableRow[];
  trend: TrendPoint[];
  csuzIndex?: { value: number; praha: number; growthPct: number; note: string } | null;
  askingPrice?: number | null;
  vsAskingPct?: number | null;
  methodology: string[];
  generatedAt: number;
}

export interface ValuationAiOutput {
  summary: string;
  drivers: string[];
  caveats: string[];
}

/** Region (kraj) — klíče shodné s CITY_TO_REGION v locality/crime.ts. */
export type RegionKey =
  | "praha"
  | "stredocesky"
  | "jihocesky"
  | "plzensky"
  | "ustecky"
  | "kralovehradecky"
  | "jihomoravsky"
  | "moravskoslezsky"
  | "olomoucky"
  | "zlinsky"
  | "vysocina"
  | "pardubicky"
  | "liberecky"
  | "karlovarsky";

export interface PriceMapRegion {
  regionKey: RegionKey | string;
  name: string;
  avgPricePerSqm: number;
  numTransactions: number;
  /** entity_id z API cenové mapy (pro drill-down do okresů) */
  entityId?: number | null;
}

/** Úroveň lokalizace realizovaných cen. */
export type RealizedLevel = "ward" | "municipality" | "district" | "region";

/** Výsledek drill-downu realizovaných cen pro konkrétní město. */
export interface RealizedLocality {
  avgPricePerSqm: number;
  numTransactions: number;
  /** region vždy (fallback hladina) */
  regionName: string;
  regionAvgPricePerSqm: number;
  regionTransactions: number;
  /** okres, pokud byl nalezen */
  districtName?: string | null;
  districtAvgPricePerSqm?: number | null;
  districtTransactions?: number | null;
  /** obec/město, pokud byl nalezen */
  localityName?: string | null;
  localityAvgPricePerSqm?: number | null;
  localityTransactions?: number | null;
  /** městská čtvrť (ward), pokud byla nalezena podle adresy */
  wardName?: string | null;
  wardAvgPricePerSqm?: number | null;
  wardTransactions?: number | null;
  entityType?: RealizedLevel;
  period: string;
  totalTransactions: number;
}

export interface PriceMapData {
  regions: PriceMapRegion[];
  trend: TrendPoint[];
  dateFrom: string;
  dateTo: string;
  fetchedAt: number;
  totalTransactions: number;
}
