/** Normalizovaný záznam nabídky z Realingo (SearchOffer). */
export interface RealingoOffer {
  id: string;
  url: string;
  purpose: string;
  property: string;
  isLocked: boolean;
  createdAt: string | null;
  category: string | null;
  price: {
    type: string | null;
    total: number | null;
    canonical: number | null;
    squareMeter: number | null;
    squareMeterCanonical: number | null;
    currency: string | null;
  } | null;
  area: { main: number | null; plot: number | null } | null;
  photos: { main: string | null; list: string[] | null } | null;
  location: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

/** Cenový rating (Valuo) jedné nabídky z LoadPriceStats. */
export interface RealingoPriceBand {
  label: string;
  minCzk: number | null;
  maxCzk: number | null;
}

export interface RealingoPriceStats {
  offerId: string;
  status: string | null;
  error: string | null;
  stats: {
    tier: string | null;
    label: string | null;
    iqrDeviation: number | null;
    n: number | null;
    lowConfidence: boolean | null;
    effectivePriceCzk: number | null;
    bands: RealingoPriceBand[];
  } | null;
}

/** Výsledek RealScan odhadu. */
export interface RealingoScanResult {
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgPriceM2: number | null;
  rangePrice: number | null;
  searchDistance: number | null;
  recordsCount: number | null;
}

export interface RealingoScanPricePoint {
  date: string | null;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgPriceM2: number | null;
}

export interface RealingoScanStatus {
  id: string;
  address: string | null;
  status: string | null;
  message: string | null;
  errorMessage: string | null;
  result: RealingoScanResult | null;
  priceIndex: RealingoScanPricePoint[] | null;
  completedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Data uživatele vrácená login/status query. */
export interface RealingoUser {
  id: string;
  email: string;
  premiumPlan: string | null;
  scanCredits: number | null;
  effectiveScanCredits: number | null;
}
