export interface UnemploymentData {
  uchazeci: number | null;
  podilNezamestnanych: number | null;
  period: string;
}

export interface MigrationData {
  obyvatel: number | null;
  prisahozivA: number | null;
  stehovaniNet: number | null;
  celkovyPrirustek: number | null;
  period: string;
}

export interface SldbData {
  populace: number | null;
  podil15_64: number | null;
  podil65plus: number | null;
  podilVysSkola: number | null;
  period: string;
}

export interface CrimeData {
  indexKriminality: number | null;
  objasnenostPct: number | null;
  okres: string;
  period: string;
}

export interface AresData {
  pocetFirem: number | null;
  pocetAktivnich: number | null;
  period: string;
}

export interface PoiCounts {
  skoly: number;
  skolky: number;
  mhd: number;
  vlak: number;
  obchody: number;
  restaurace: number;
  zdravotnictvi: number;
  lekarny: number;
  sport: number;
  parky: number;
  bankomaty: number;
}

export interface LocalityFactors {
  economic: { score: number; unemploymentPct: number | null; firms: number | null };
  demographic: { score: number; migrationNet: number | null; population: number | null; share65plus: number | null };
  walkability: { score: number; counts: Partial<PoiCounts> };
  safety: { score: number; crimeIndex: number | null };
  transport: { score: number; premiumPct: number | null };
  rental: { score: number; rentPerSqm: number | null; grossYieldPct: number | null };
  total: number;
  sourceData: {
    unemployment?: { value: number | null; period: string };
    migration?: { value: number | null; period: string };
    sldb?: { value: number | null; period: string };
    crime?: { value: number | null; period: string };
    ares?: { value: number | null; period: string };
    poi?: { district: string; fetchedAt: number };
  };
  weights: { economic: number; demographic: number; walkability: number; safety: number };
  missing: string[];
}

export const LOCALITY_WEIGHTS = {
  economic: 30,
  demographic: 25,
  walkability: 25,
  safety: 20,
} as const;

export const RENT_WEIGHTS = {
  rent: 50,
  transport: 50,
} as const;
