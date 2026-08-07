/**
 * Odhad — oceňovací engine.
 *
 * Metodika (transparentní, žádná vymyšlená čísla):
 *  1. Realizované prodeje (Seznam cenová mapa, ČÚZK): průměr kraje Kč/m² za posledních
 *     12 měsíců, upravený multiplikátory stav/typ/kategorie na profil nemovitosti.
 *  2. Nabídkové kompy (vlastní DB + sreality vzorky + MARKET_DATA fallback):
 *     medián Kč/m² pro město/segment z existující kaskády Tier 1–5.
 *  3. Blend = vážený průměr (realizované 45 % / nabídky 35 %, po normalizaci vah).
 *  4. Úprava plochy: menší byty mívají vyšší Kč/m² (elasticita ~0,1, clamp 0,85–1,15).
 *  5. Rozmezí = odhad ± spread odvozený z kvality dat; confidence 0–100.
 *
 * Všechny zdroje jsou volitelné (injekce) kvůli testovatelnosti.
 */

import {
  getPropertyMarketRange,
  fetchComparableSamples,
  haversineKm,
  type MarketRangeResult,
  type CompSample,
} from "@/lib/scraping/market-price-service";
import { conditionMultiplier, buildingTypeMultiplier, categoryMultiplier } from "@/lib/analysis/market-data";
import { cityNamesFor } from "@/lib/analysis/location";
import { getRealizedRegionForCity } from "./price-map";
import { CSUZ_INDEX } from "./czso-trend";
import type { ComparableRow, ConfidenceLabel, SourceInfo, ValuationInput, ValuationResult } from "./types";

interface EngineDeps {
  getRealized?: (cityKey: string) => ReturnType<typeof getRealizedRegionForCity>;
  getRange?: (ctx: Parameters<typeof getPropertyMarketRange>[0]) => Promise<MarketRangeResult | null>;
  getComps?: (ctx: Parameters<typeof fetchComparableSamples>[0]) => Promise<CompSample[]>;
  now?: number;
}

const VALUATION_WEIGHTS = {
  realized: 0.45,
  offers: 0.35,
} as const;

function roundKc(n: number): number {
  return Math.max(0, Math.round(n / 1000) * 1000);
}

function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 70) return "Vysoká";
  if (score >= 40) return "Střední";
  return "Nízká";
}

/** Úprava Kč/m² podle plochy — menší jednotky jsou na m² dražší. */
export function areaSizeFactor(area: number | null | undefined): number {
  if (!area || area <= 0) return 1;
  const f = Math.pow(60 / area, 0.1);
  return Math.min(1.15, Math.max(0.85, f));
}

export async function estimateProperty(
  input: ValuationInput,
  deps: EngineDeps = {}
): Promise<ValuationResult> {
  const {
    getRealized = getRealizedRegionForCity,
    getRange = (ctx) => getPropertyMarketRange(ctx),
    getComps = fetchComparableSamples,
    now = Date.now(),
  } = deps;

  const { cityKey, condition, buildingType, category, area, lat, lng } = input;
  const mult = conditionMultiplier(condition ?? null) * buildingTypeMultiplier(buildingType ?? null) * categoryMultiplier(category ?? null);
  const areaFactor = areaSizeFactor(area);

  // ---------- 1) Sběr zdrojů (paralelně) ----------
  const [realized, range] = await Promise.all([
    getRealized(cityKey).catch(() => null),
    getRange({ cityKey, lat, lng, condition, buildingType, area, category }).catch(() => null),
  ]);

  // ---------- 2) Složky ----------
  const sources: SourceInfo[] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  if (realized && realized.avgPricePerSqm > 0) {
    const realizedAdj = realized.avgPricePerSqm * mult;
    sources.push({
      key: "realized",
      label: "Realizované prodeje — kraj",
      pricePerSqm: Math.round(realizedAdj),
      sampleSize: realized.numTransactions,
      weight: VALUATION_WEIGHTS.realized,
      note: `${realized.regionName}, ${realized.period}. Průměrná cena ${realized.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² z ${realized.numTransactions.toLocaleString("cs-CZ")} transakcí (ČÚZK přes Seznam cenovou mapu), upraveno multiplikátory stav/typ.`,
    });
    weightedSum += realizedAdj * VALUATION_WEIGHTS.realized;
    weightTotal += VALUATION_WEIGHTS.realized;
  }

  if (range && range.median > 0) {
    const offerMedian = range.median;
    sources.push({
      key: "offers",
      label: "Nabídkové ceny — město",
      pricePerSqm: Math.round(offerMedian),
      sampleSize: range.sampleSize,
      weight: VALUATION_WEIGHTS.offers,
      note: `Medián nabídkových cen pro ${cityKey} / segment (zdroj: ${range.source}${range.sampleSize ? `, ${range.sampleSize} vzorků` : ""}).`,
    });
    weightedSum += offerMedian * VALUATION_WEIGHTS.offers;
    weightTotal += VALUATION_WEIGHTS.offers;
  }

  // ---------- 3) Odhad ----------
  let pricePerSqm: number | null = null;
  let spread = 0.1;
  if (weightTotal > 0) {
    pricePerSqm = (weightedSum / weightTotal) * areaFactor;
    // spread: kvalita dat
    if (realized && realized.numTransactions < 2000) spread += 0.02;
    if (range) {
      const r = range.low > 0 && range.high > 0 ? range.high / range.low : 1;
      if (r > 1.5) spread += 0.05;
      else if (r > 1.25) spread += 0.03;
    }
    if (!realized) spread += 0.04;
    if (!input.condition) spread += 0.015;
    if (!input.category) spread += 0.015;
    spread = Math.min(0.28, Math.max(0.05, spread));
  }

  const areaSafe = area && area > 0 ? area : null;
  const estimate = pricePerSqm != null && areaSafe ? Math.round(pricePerSqm * areaSafe) : 0;

  // ---------- 4) Confidence ----------
  let confidenceScore = 25;
  if (realized) confidenceScore += Math.min(30, 10 + Math.log10(Math.max(1, realized.numTransactions)) * 8);
  if (range && (range.source === "db" || range.source === "sreality")) confidenceScore += 15;
  else if (range) confidenceScore += 5;
  if (areaSafe) confidenceScore += 10;
  if (input.condition) confidenceScore += 5;
  if (input.category) confidenceScore += 5;
  if (lat != null && lng != null) confidenceScore += 5;
  if (range && range.high > 0 && range.low > 0) {
    const r = range.high / range.low;
    if (r > 1.5) confidenceScore -= 10;
    else if (r > 1.25) confidenceScore -= 5;
  }
  confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)));

  const low = estimate * (1 - spread);
  const high = estimate * (1 + spread);

  // ---------- 5) Srovnatelné ----------
  const comparables: ComparableRow[] = [];
  if (realized) {
    comparables.push({
      label: `Průměr kraje (${realized.regionName})`,
      pricePerSqm: realized.avgPricePerSqm,
      source: "realized",
    });
  }
  try {
    const samples = await getComps({ cityKey, lat, lng, condition, buildingType, area, category });
    const cityNames = cityNamesFor(cityKey);
    const minArea = areaSafe ? areaSafe * 0.7 : null;
    const maxArea = areaSafe ? areaSafe * 1.3 : null;

    const near = samples
      .filter((s) => {
        if (s.pricePerSqm <= 0) return false;
        if (lat != null && lng != null) {
          if (s.lat != null && s.lng != null && haversineKm(lat, lng, s.lat, s.lng) > 10) return false;
        } else if (!cityNames.some((n) => (s.address ?? "").toLowerCase().includes(n.toLowerCase()))) {
          return false;
        }
        if (minArea != null && s.area != null && (s.area < minArea || s.area > maxArea!)) return false;
        return true;
      })
      .map((s) => ({
        label: s.address ?? "Neznámá adresa",
        area: s.area,
        price: s.price,
        pricePerSqm: s.pricePerSqm,
        distanceKm:
          lat != null && lng != null && s.lat != null && s.lng != null ? haversineKm(lat, lng, s.lat, s.lng) : null,
        source: "offer" as const,
        condition: s.condition ?? null,
      }))
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
      .slice(0, 14);

    for (const c of near) {
      // dedup podle adresy (jen u známých adres — "Neznámá adresa" se neslučuje)
      if (c.label !== "Neznámá adresa" && comparables.some((x) => x.label === c.label)) continue;
      comparables.push(c);
      if (comparables.length >= 15) break;
    }
  } catch {
    // kompy jsou doplněk — selhání nebrání odhadu
  }

  // ---------- 6) Metodika + výstup ----------
  const methodology: string[] = [
    "Odhad kombinuje realizované prodejní ceny (ČÚZK data přes Seznam cenovou mapu, posledních 12 měsíců) a nabídkové ceny z vlastní databáze nemovitostí.",
  ];
  if (realized) {
    methodology.push(
      `Realizované prodeje: průměr kraje ${realized.regionName} je ${realized.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² (${realized.numTransactions.toLocaleString("cs-CZ")} transakcí, ${realized.period}).`
    );
  }
  if (range) {
    methodology.push(
      `Nabídkové ceny: medián ${range.median.toLocaleString("cs-CZ")} Kč/m² (rozmezí ${range.low.toLocaleString("cs-CZ")}–${range.high.toLocaleString("cs-CZ")}, zdroj ${range.source}${range.sampleSize ? `, ${range.sampleSize} vzorků` : ""}).`
    );
  }
  methodology.push(
    `Úprava plochy ${areaFactor.toFixed(2)}× (menší jednotky = vyšší Kč/m²), multiplikátory stav/typ/kategorie ${mult.toFixed(2)}×.`
  );
  methodology.push("Odhad je orientační, založený na veřejných datech. Nenahrazuje znalecký posudek.");

  const askingPrice = input.askingPrice && input.askingPrice > 0 ? input.askingPrice : null;

  return {
    estimate: roundKc(estimate),
    low: roundKc(low),
    high: roundKc(high),
    pricePerSqm: pricePerSqm != null ? Math.round(pricePerSqm) : 0,
    lowPerSqm: pricePerSqm != null ? Math.round(pricePerSqm * (1 - spread)) : 0,
    highPerSqm: pricePerSqm != null ? Math.round(pricePerSqm * (1 + spread)) : 0,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    sources,
    comparables,
    trend: [],
    csuzIndex: {
      value: CSUZ_INDEX.cr,
      praha: CSUZ_INDEX.praha,
      growthPct: CSUZ_INDEX.growthPct,
      note: CSUZ_INDEX.note,
    },
    askingPrice,
    vsAskingPct:
      askingPrice && estimate > 0 ? Math.round(((estimate - askingPrice) / askingPrice) * 1000) / 10 : null,
    methodology,
    generatedAt: now,
  };
}

/** Dopočte trend z cenové mapy a vloží do výsledku (UI vrstva). */
export function attachTrend(result: ValuationResult, trend: { monthYear: string; price: number }[]): ValuationResult {
  return { ...result, trend };
}
