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
import { getRealizedLocalityForCity, type RealizedContext } from "./price-map";
import { CSUZ_INDEX } from "./czso-trend";
import type { ComparableRow, ConfidenceLabel, RealizedLocality, SourceInfo, ValuationInput, ValuationResult } from "./types";

interface EngineDeps {
  getRealized?: (cityKey: string, ctx?: RealizedContext) => Promise<RealizedLocality | null>;
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

/**
 * Úprava Kč/m² podle plochy — menší jednotky jsou na m² dražší (realistická křivka
 * českého trhu: 1+kk ~35 m² ≈ +15 %, 4+kk ~100 m² ≈ −12 %). Exponenciální model
 * s exponentem 0,25 a clampem 0,7–1,3.
 */
export function areaSizeFactor(area: number | null | undefined): number {
  if (!area || area <= 0) return 1;
  const f = Math.pow(60 / area, 0.25);
  return Math.min(1.3, Math.max(0.7, f));
}

/**
 * Úprava podle patra — přízemí a 1. patro (bez výtahu) jsou mírně levnější.
 * Bez znalosti celkového počtu pater nelze top-floor detekovat, proto jen konzervativní srážky.
 */
export function floorMultiplier(floor: number | null | undefined): number {
  if (floor == null || floor < 0) return 1;
  if (floor === 0) return 0.95;
  if (floor === 1) return 0.98;
  return 1;
}

/** Úprava podle roku výstavby — novější fond je dražší (mírné, nesoupeří s condition). */
export function yearBuiltMultiplier(year: number | null | undefined): number {
  if (!year || year < 1850) return 1;
  if (year < 1945) return 0.96;
  if (year < 1990) return 0.98;
  if (year <= 2005) return 1.02;
  if (year <= 2015) return 1.05;
  return 1.08;
}

/**
 * Adresní shoda s názvem města na hranicích slova.
 * Oproti addressMatchesCity (naivní substring) nechytá falešné shody jako
 * „u mostu" pro město Most nebo „na oseku" pro Osek — krátké/obecné názvy
 * měst by jinak propustily cizí vzorky do komparací.
 */
function addressContainsCity(address: string | null | undefined, cityNames: string[]): boolean {
  if (!address) return false;
  const addr = address.toLowerCase();
  return cityNames.some((name) => {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-záčďéěíňóřšťúůýž])${esc}($|[^a-záčďéěíňóřšťúůýž])`).test(addr);
  });
}

export async function estimateProperty(
  input: ValuationInput,
  deps: EngineDeps = {}
): Promise<ValuationResult> {
  const {
    getRealized = getRealizedLocalityForCity,
    getRange = (ctx) => getPropertyMarketRange(ctx),
    getComps = fetchComparableSamples,
    now = Date.now(),
  } = deps;

  const { cityKey, condition, buildingType, category, area, lat, lng } = input;
  const mult =
    conditionMultiplier(condition ?? null) *
    buildingTypeMultiplier(buildingType ?? null) *
    categoryMultiplier(category ?? null) *
    floorMultiplier(input.floor) *
    yearBuiltMultiplier(input.yearBuilt);
  const areaFactor = areaSizeFactor(area);

  // ---------- 1) Sběr zdrojů (paralelně) ----------
  // realizované prodeje dostávají adresu/GPS/hinty → drill-down až na městskou čtvrť (ward)
  const [realized, range] = await Promise.all([
    getRealized(cityKey, {
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      wardHints: input.wardHints,
    }).catch(() => null),
    getRange({ cityKey, lat, lng, condition, buildingType, area, category }).catch(() => null),
  ]);

  // ---------- 2) Složky ----------
  const sources: SourceInfo[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let offersClamped = false;
  let realizedAdj = 0;

  if (realized && realized.avgPricePerSqm > 0) {
    // Čtvrťové/obecní průměry bývají zkreslené novostavbami (developerské prodeje),
    // hlavně v prémiových lokalitách (Žižkov 160k vs. kraj Praha 112k). Pokud je čtvrť
    // výrazně nad regionem, stáhneme ji k regionu (partial pooling) — konzervativnější
    // a blíž realitě běžného bytového fondu.
    const regionRatio = realized.avgPricePerSqm / Math.max(1, realized.regionAvgPricePerSqm);
    const shrinkToRegion =
      (realized.entityType === "ward" || realized.entityType === "municipality") && regionRatio > 1.35;
    realizedAdj = realized.avgPricePerSqm * mult;
    if (shrinkToRegion) {
      realizedAdj = (0.75 * realized.avgPricePerSqm + 0.25 * realized.regionAvgPricePerSqm) * mult;
    }
    // Skladba fondu: průměr čtvrti/města zahrnuje novostavby (×1,15) a renovované
    // (×1,08) — nejsilnější segment, který průměr tlačí nad úroveň běžného fondu.
    // Byt v běžném stavu („good") je proto pod průměrem čtvrti (K Lučinám vs. Valuo:
    // 160k průměr Žižkova vs. ~130k běžný stav). Srážka jen pro čtvrti/obce —
    // na krajské hladině je mix vyrovnanější.
    const mixSkew = condition === "good" && (realized.entityType === "ward" || realized.entityType === "municipality");
    if (mixSkew) {
      realizedAdj *= 0.94;
    }
    // nejpřesnější dostupná úroveň: čtvrť > obec > okres > kraj
    const levelLabel =
      realized.entityType === "ward"
        ? `Realizované prodeje — čtvrť ${realized.wardName ?? ""}`
        : realized.entityType === "municipality"
          ? `Realizované prodeje — ${realized.localityName ?? "město"}`
          : realized.entityType === "district"
            ? `Realizované prodeje — okres (${realized.districtName ?? ""})`
            : `Realizované prodeje — ${realized.regionName}`;
    const levelNote =
      realized.entityType === "ward" && realized.wardName
        ? `Čtvrť ${realized.wardName} (${realized.localityName ? `obec ${realized.localityName}, ` : ""}${realized.regionName}): průměr ${realized.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² z ${realized.numTransactions.toLocaleString("cs-CZ")} transakcí (ČÚZK přes Seznam cenovou mapu).`
        : realized.entityType === "municipality" && realized.localityName
          ? `Město ${realized.localityName} (okres ${realized.districtName ?? "—"}, ${realized.regionName}): průměr ${realized.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² z ${realized.numTransactions.toLocaleString("cs-CZ")} transakcí (ČÚZK přes Seznam cenovou mapu).`
          : realized.entityType === "district"
            ? `Okres ${realized.districtName ?? ""} (${realized.regionName}): průměr ${realized.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² z ${realized.numTransactions.toLocaleString("cs-CZ")} transakcí.`
            : `${realized.regionName}, ${realized.period}. Průměrná cena ${realized.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² z ${realized.numTransactions.toLocaleString("cs-CZ")} transakcí.`;
    sources.push({
      key: "realized",
      label: levelLabel,
      pricePerSqm: Math.round(realizedAdj),
      sampleSize: realized.numTransactions,
      weight: VALUATION_WEIGHTS.realized,
      note: `${levelNote} Upraveno multiplikátory stav/typ.${shrinkToRegion ? " Čtvrťový průměr je nad krajským o více než 35 % — korigováno směrem ke krajské hladině (novostavby)." : ""}${mixSkew ? " Srážka za běžný stav — průměr čtvrti/města tlačí nahoru novostavby a renovované." : ""}`,
    });
    weightedSum += realizedAdj * VALUATION_WEIGHTS.realized;
    weightTotal += VALUATION_WEIGHTS.realized;
  }

  if (range && range.median > 0) {
    // Váha závisí na kvalitě zdroje: reálné kompy (DB/sreality) plná váha,
    // odhad trhu z fixních dat nižší, celorepublikový fallback minimální
    // (jinak by Cheb dostal ceny Prahy/ČR). Reálné kompy navíc dostávají
    // srážku podle počtu vzorků (3 vzorky ≠ 20) — málo vzorků nemá plnou váhu.
    const sourceQuality =
      range.source === "db" || range.source === "sreality" ? 1 : range.source === "market_data" ? 0.6 : 0.3;
    const sampleFactor = range.source === "db" || range.source === "sreality" ? Math.min(1, (range.sampleSize || 0) / 8) : 1;
    const weight = VALUATION_WEIGHTS.offers * sourceQuality * sampleFactor;
    // Clamp nabídek do rozumného pásma kolem realizovaných — luxusní/novostavbové
    // vzorky nesmí tahat odhad mimo realitu (např. 181k nabídky na Žižkově).
    let offerMedian = range.median;
    let clamped = false;
    if (realized && realized.avgPricePerSqm > 0) {
      // pásmo ±25 % kolem realizovaných — prémiové/luxusní nabídky (např. Žižkov 203k vs.
      // realizované 150k) se nesmí odchýlit o víc, jinak tahají odhad mimo realitu trhu
      const band = { low: 0.75 * realizedAdj, high: 1.25 * realizedAdj };
      if (offerMedian < band.low) {
        offerMedian = band.low;
        clamped = true;
      } else if (offerMedian > band.high) {
        offerMedian = band.high;
        clamped = true;
      }
    }
    const label =
      range.source === "db" || range.source === "sreality"
        ? "Nabídkové ceny — město"
        : range.source === "market_data"
          ? "Nabídkové ceny — město (odhad trhu)"
          : "Nabídkové ceny — ČR (fallback)";
    sources.push({
      key: "offers",
      label,
      pricePerSqm: Math.round(offerMedian),
      sampleSize: range.sampleSize,
      weight,
      note: `Medián nabídkových cen pro ${cityKey} / segment (zdroj: ${range.source}${range.sampleSize ? `, ${range.sampleSize} vzorků` : ""}).${clamped ? " Nabídky byly vychýlené mimo pásmo realizovaných cen — omezeno na něj." : ""}`,
    });
    weightedSum += offerMedian * weight;
    weightTotal += weight;
    if (clamped) offersClamped = true;
  }

  // ---------- 3) Odhad ----------
  let pricePerSqm: number | null = null;
  // spread dle kvality dat: čtvrť/obec = nejužší (±5–6 % jako Valuo), kraj = širší
  let spread = 0.08;
  if (weightTotal > 0) {
    pricePerSqm = (weightedSum / weightTotal) * areaFactor;
    if (realized) {
      if (realized.entityType === "ward") spread -= 0.025;
      else if (realized.entityType === "municipality") spread -= 0.02;
      else if (realized.entityType === "district") spread -= 0.01;
      if (realized.numTransactions < 1000) spread += 0.01;
    }
    if (range) {
      const r = range.low > 0 && range.high > 0 ? range.high / range.low : 1;
      if (r > 1.5) spread += 0.03;
      else if (r > 1.25) spread += 0.01;
    }
    if (!realized) spread += 0.05;
    if (!input.condition) spread += 0.01;
    if (!input.category) spread += 0.01;
    if (!input.address?.trim()) spread += 0.01;
    // nesoulad nabídek a realizovaných = nejistota → širší rozmezí
    if (offersClamped) spread += 0.02;
    spread = Math.min(0.18, Math.max(0.05, spread));
  }

  const areaSafe = area && area > 0 ? area : null;
  const estimate = pricePerSqm != null && areaSafe ? Math.round(pricePerSqm * areaSafe) : 0;

  // ---------- 4) Confidence ----------
  let confidenceScore = 25;
  if (realized) {
    confidenceScore += Math.min(30, 10 + Math.log10(Math.max(1, realized.numTransactions)) * 8);
    if (realized.entityType === "ward") confidenceScore += 8;
    else if (realized.entityType === "municipality") confidenceScore += 5;
    else if (realized.entityType === "district") confidenceScore += 3;
  }
  if (range && (range.source === "db" || range.source === "sreality")) confidenceScore += 15;
  else if (range && range.source === "market_data") confidenceScore += 8;
  else if (range) confidenceScore += 3;
  if (areaSafe) confidenceScore += 10;
  if (input.condition) confidenceScore += 5;
  if (input.category) confidenceScore += 5;
  if (lat != null && lng != null) confidenceScore += 5;
  if (input.address?.trim()) confidenceScore += 3;
  if (range && range.high > 0 && range.low > 0) {
    const r = range.high / range.low;
    if (r > 1.5) confidenceScore -= 10;
    else if (r > 1.25) confidenceScore -= 5;
  }
  // nikdy nehlasit 100 % — odhad je vždy jen odhad (Valuo ukazuje i u sebe rezervu)
  confidenceScore = Math.max(0, Math.min(95, Math.round(confidenceScore)));

  const low = estimate * (1 - spread);
  const high = estimate * (1 + spread);

  // ---------- 5) Srovnatelné ----------
  const comparables: ComparableRow[] = [];
  if (realized) {
    // čtvrť → obec → okres → kraj jako kontext (od nejužší po nejširší); kraj vždy
    const realizedRows: { label: string; price: number }[] = [];
    if (realized.entityType === "region") {
      realizedRows.push({ label: `Průměr kraje (${realized.regionName})`, price: realized.regionAvgPricePerSqm });
    } else {
      if (realized.entityType === "ward" && realized.wardName && realized.wardAvgPricePerSqm != null) {
        realizedRows.push({ label: `Čtvrť (${realized.wardName})`, price: realized.wardAvgPricePerSqm });
      }
      if (realized.localityName && realized.localityAvgPricePerSqm != null) {
        realizedRows.push({ label: `Město (${realized.localityName})`, price: realized.localityAvgPricePerSqm });
      }
      if (realized.districtName && realized.districtAvgPricePerSqm != null) {
        realizedRows.push({ label: `Okres (${realized.districtName})`, price: realized.districtAvgPricePerSqm });
      }
      realizedRows.push({ label: `Kraj (${realized.regionName})`, price: realized.regionAvgPricePerSqm });
    }
    for (const row of realizedRows) {
      comparables.push({ label: row.label, pricePerSqm: row.price, source: "realized" });
    }
  }
  try {
    const samples = await getComps({ cityKey, lat, lng, condition, buildingType, area, category });
    const cityNames = cityNamesFor(cityKey);
    const minArea = areaSafe ? areaSafe * 0.7 : null;
    const maxArea = areaSafe ? areaSafe * 1.3 : null;
    const targetHasGps = lat != null && lng != null;

    const near = samples
      .filter((s) => {
        if (s.pricePerSqm <= 0) return false;
        const sampleHasGps = s.lat != null && s.lng != null;
        if (targetHasGps && sampleHasGps) {
          // obě strany mají GPS → okruh 10 km
          if (haversineKm(lat!, lng!, s.lat!, s.lng!) > 10) return false;
        } else {
          // nemovitost nebo vzorek nemá GPS → kontrola musí proběhnout přes adresu města,
          // jinak by se do komparací dostaly inzeráty z celé republiky
          if (!addressContainsCity(s.address, cityNames)) return false;
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
    const scope =
      realized.entityType === "ward" && realized.wardName
        ? `čtvrti ${realized.wardName} (${realized.localityName ? `obec ${realized.localityName}, ` : ""}kraj ${realized.regionName})`
        : realized.entityType === "municipality" && realized.localityName
          ? `města ${realized.localityName} (okres ${realized.districtName ?? "—"}, kraj ${realized.regionName})`
          : realized.entityType === "district" && realized.districtName
            ? `okresu ${realized.districtName} (kraj ${realized.regionName})`
            : `kraje ${realized.regionName}`;
    methodology.push(
      `Realizované prodeje: průměr ${scope} je ${realized.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² (${realized.numTransactions.toLocaleString("cs-CZ")} transakcí, ${realized.period}).`
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
