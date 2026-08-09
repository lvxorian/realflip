/**
 * Modul Odhad — typy.
 * Vstup = vlastnosti nemovitosti (z URL nebo ručně), výstup = cenový odhad
 * kombinující realizované prodeje (Seznam cenová mapa), ČSÚ statistiky
 * a nabídkové kompy z vlastní DB.
 */

import type { TransportFactor } from "@/lib/locality/transport";

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
  /** Celkový počet podlaží budovy (pro detekci podkroví/nejvyššího patra). */
  totalFloors?: number | null;
  /** Výtah v domě (true/false) — bez výtahu od 3. patra srážka −10–15 %. */
  elevator?: boolean | null;
  condition?: string | null;
  buildingType?: string | null;
  category?: string | null;
  yearBuilt?: number | null;
  /** Vlastnictví: personal (osobní) / cooperative (družstevní) / other. Družstevní = sleva ~14 %. */
  ownership?: "personal" | "cooperative" | "other" | null;
  askingPrice?: number | null;
  balcony?: boolean | null;
  /** Balkón/lodžie/terasa v m² — přirážka +4–10 %. */
  balconyArea?: number | null;
  /** Vlastní zahrada/předzahrádka v m² — přirážka +8–20 %. */
  gardenArea?: number | null;
  /** Sklep v m² — mírná přirážka. */
  cellarArea?: number | null;
  /** Okno realizovaných prodejů (6/12/24 měsíců). null = auto dle likvidity města. */
  lookbackMonths?: 6 | 12 | 24 | null;
  /** Datum odhadu „k datu" (YYYY-MM) — zpětný odhad indexovaný cenovým vývojem. */
  asOfDate?: string | null;
  sourceUrl?: string | null;
  /** Hinty na městskou čtvrť (z reverse geokódu / adresy) — pro ward-level realizované ceny. Server-only. */
  wardHints?: string[] | null;
  /** Dopravní dostupnost (Vlak Index) — vzdálenosti metra/vlaku/busu, vyplňuje server. */
  transport?: TransportFactor | null;
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
  /**
   * Kč/m² — null pro adresní transakce z cenové mapy (estate_list): ČÚZK/Seznam
   * anonymizuje ceny jednotlivých prodejů, známe jen GPS + č.p. + velikost + datum.
   */
  pricePerSqm: number | null;
  distanceKm?: number | null;
  source: "realized" | "offer";
  condition?: string | null;
  /** Datum prodeje (vlastní historie — párování zmizelých inzerátů, nebo adresní transakce cenové mapy). */
  soldAt?: number | null;
  /** Adresní transakce z cenové mapy (estate_list) — bez veřejné ceny, s GPS + č.p. */
  addressTx?: boolean;
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
  /** Dopravní vrstva odhadu (Vlak Index) — použitý faktor i pro UI. */
  transport?: TransportFactor | null;
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

/**
 * AI korekce odhadu směrem k mikro-poloze (adresa/ulice/čtvrť).
 * Gemini dostane kompy + čtvrť a navrhne úpravu v % kolem statistického odhadu.
 * `adjustmentPct` je clampnutý serverem na ±15 % — model nemůže vymyslet libovolná čísla.
 */
export interface ValuationAiCorrection {
  /** Úprava v % kolem statistického mediánu (např. -6.5 = -6,5 %). */
  adjustmentPct: number;
  /** Upravená cena Kč/m² (statistický medián × (1 + adjustmentPct/100)). */
  adjustedPricePerSqm: number;
  /** Upravená celková cena Kč. */
  adjustedEstimate: number;
  /** "up" | "down" | "neutral" — dle znaménka úpravy. */
  direction: "up" | "down" | "neutral";
  confidence: ConfidenceLabel;
  /** Odůvodnění česky (mikro-poloha: ulice, doprava, občanská vybavenost, hluk…). */
  reasoning: string;
  /** 2-4 klíčové mikro-polohové faktory. */
  factors: string[];
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
  /** entity_id čtvrti — pro drill na adresní transakce (estate_list) */
  wardId?: number | null;
  wardAvgPricePerSqm?: number | null;
  wardTransactions?: number | null;
  entityType?: RealizedLevel;
  period: string;
  totalTransactions: number;
  /** Měsíční trend cen (ČR, cenová mapa) — pro indexaci realizovaných na dnešek (BUG 5). */
  trend?: TrendPoint[];
}

export interface PriceMapData {
  regions: PriceMapRegion[];
  trend: TrendPoint[];
  dateFrom: string;
  dateTo: string;
  fetchedAt: number;
  totalTransactions: number;
}

/**
 * Adresní transakce z cenové mapy (estate_list) — jednotlivé realizované prodeje
 * na úrovni čísla popisného. Cena per transakce NENÍ veřejně dostupná
 * (ČÚZK/Seznam anonymizuje), ale máme přesné GPS, č.p., velikostní kategorii
 * a datum — ideální pro komparace s konkrétními adresami (na rozdíl od agregátu čtvrti).
 */
export interface AddressTransaction {
  /** Unikátní ID transakce z cenové mapy. */
  transactionId: number;
  /** ID adresy (č.p. v RÚIAN) — null, pokud není dostupné. */
  addressId: number | null;
  /** Číslo popisné / evidenční („1291", „334"). */
  housenumber: string | null;
  /** Přesné GPS transakce. */
  lat: number | null;
  lng: number | null;
  /** Obec („Praha", „Cheb"). */
  municipality: string | null;
  /** Čtvrť („Kyje", „Žižkov"). */
  ward: string | null;
  /** entity_id čtvrti. */
  wardId: number | null;
  /** Velikostní kategorie z titulu („Byt, 66–70 m²") — parsovatelná na rozsah m². */
  areaCategory: string | null;
  /** Datum transakce (YYYY-MM-DD). */
  validationDate: string | null;
}
