/**
 * Odhad — oceňovací engine.
 *
 * Metodika (transparentní, žádná vymyšlená čísla):
 *  1. Realizované prodeje (Seznam cenová mapa, ČÚZK): průměr kraje Kč/m² za posledních
 *     12 měsíců, upravený multiplikátory stav/typ/kategorie na profil nemovitosti.
 *  2. Nabídkové kompy (vlastní DB + sreality vzorky + MARKET_DATA fallback):
 *     medián Kč/m² pro město/segment z existující kaskády Tier 1–5.
 *  3. Cenovka inzerátu (kotva, jen URL flow se známou cenou): doplňkový signál 10 %
 *     — cenovka už jednou vstupuje přes cap realizované reference (105 %), proto jen 10 %.
 *  4. Blend = vážený průměr (realizované 45 % / nabídky 35 % / kotva 10 %, po normalizaci vah).
 *  5. Úprava plochy: menší byty mívají vyšší Kč/m² (elasticita ~0,1, clamp 0,85–1,15).
 *  6. Rozmezí = odhad ± spread odvozený z kvality dat; confidence 0–100.
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
import {
  conditionMultiplier,
  buildingTypeMultiplier,
  categoryMultiplier,
  ownershipMultiplier,
  floorMultiplier,
  balconyMultiplier,
  gardenMultiplier,
  cellarMultiplier,
} from "@/lib/analysis/market-data";
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
  // Cenovka inzerátu = nejlokálnější aktuální tržní signál (přímo na tento byt).
  // Jen jako doplňková kotva (10 %) — cenovka už raz vstupuje přes cap realizované
  // reference (105 %), takže plná váha by cenovku započítala DVAKRÁT a systémově
  // by tlačila odhad nad transakční hladinu (Valuo cenovku nezná vůbec; inzeráty
  // běžně žádají 5–15 % nad tržní hodnotou).
  asking: 0.1,
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
 * Dopravní faktor (Vlak Index) — skóre dopravní dostupnosti 0–100 → násobitel.
 * Skóre 50 = průměr (×1,00), 100 = výborná doprava (×1,06), 0 = bez dopravy (×0,94).
 * Lineární křivka jako Valuo Vlak Index; doprava nikdy nesmí měnit odhad o víc než ±6 %.
 */
export function transportMultiplier(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 1;
  const clamped = Math.max(0, Math.min(100, score));
  return Math.min(1.06, Math.max(0.94, 1 + ((clamped - 50) / 50) * 0.06));
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
    ownershipMultiplier(input.ownership) *
    floorMultiplier(input.floor, input.totalFloors, input.elevator) *
    yearBuiltMultiplier(input.yearBuilt) *
    balconyMultiplier(input.balconyArea) *
    gardenMultiplier(input.gardenArea) *
    cellarMultiplier(input.cellarArea);
  const areaFactor = areaSizeFactor(area);
  // Dopravní vrstva (Vlak Index) — skóre z reálných POI vzdáleností (metro/vlak/bus).
  const transportMult = transportMultiplier(input.transport?.score);

  // ---------- 1) Sběr zdrojů (paralelně) ----------
  // realizované prodeje dostávají adresu/GPS/hinty → drill-down až na městskou čtvrť (ward)
  const [realized, range] = await Promise.all([
    getRealized(cityKey, {
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      wardHints: input.wardHints,
      lookbackMonths: input.lookbackMonths,
      asOfDate: input.asOfDate,
    }).catch(() => null),
    getRange({ cityKey, lat, lng, condition, buildingType, area, category }).catch(() => null),
  ]);

  // ---------- 2) Složky ----------
  const sources: SourceInfo[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let offersClamped = false;
  let realizedAdj = 0;
  // Cenovka inzerátu (Kč/m²) — kotva; null když není cena nebo je nevěrohodná
  const askingPerSqmBlock =
    input.askingPrice && area && area > 0 && input.askingPrice / area > 30000 && input.askingPrice / area < 300000
      ? input.askingPrice / area
      : null;

  if (realized && realized.avgPricePerSqm > 0) {
    // Kotva na cenovku inzerátu: průměr čtvrti/obce/kraje (ČÚZK) nesmí implikovat
    // hodnotu výrazně nad tím, co majitel dnes žádá — asking ≥ realized je tržní norma.
    // Pokud je čtvrťový průměr vysoko nad cenovkou, je zkreslený novostavbami a/nebo
    // malým vzorkem (Kyje: 145 068 Kč/m² z 29 tx vs. cenovka paneláku 115 844 Kč/m²).
    // Referenční hladinu pak omezíme na 105 % cenovky. Cenovka mimo rozumný rozsah
    // (překlep, jiný typ) cap nespouští; 0,5× hranice chrání před extrémně nízkou
    // cenovkou (podíl, nezvyklý typ).
    const askingCap =
      askingPerSqmBlock != null && askingPerSqmBlock >= realized.avgPricePerSqm * 0.5
        ? askingPerSqmBlock * 1.05
        : null;
    let realizedRef = realized.avgPricePerSqm;
    let realizedCapped = false;
    if (askingCap != null && realized.avgPricePerSqm > askingCap) {
      realizedRef = askingCap;
      realizedCapped = true;
    }

    // Čtvrťové/obecní průměry bývají zkreslené novostavbami (developerské prodeje),
    // hlavně v prémiových lokalitách (Žižkov 160k vs. kraj Praha 112k). Pokud je čtvrť
    // výrazně nad regionem, stáhneme ji k regionu (partial pooling) — konzervativnější
    // a blíž realitě běžného bytového fondu.
    const regionRatio = realized.avgPricePerSqm / Math.max(1, realized.regionAvgPricePerSqm);
    const shrinkToRegion =
      (realized.entityType === "ward" || realized.entityType === "municipality") && regionRatio > 1.35;
    realizedAdj = realizedRef * mult;
    if (shrinkToRegion) {
      // Obě korekce jsou konzervativní — vezmeme nižší referenci, takže cap na cenovku
      // platí i ve chvíli, kdy se čtvrť táhne ke kraji (jinak by shrink surový průměr
      // čtvrti cap obešel).
      const shrinkRef = 0.75 * realized.avgPricePerSqm + 0.25 * realized.regionAvgPricePerSqm;
      realizedAdj = Math.min(realizedRef, shrinkRef) * mult;
    }
    // Skladba fondu: průměr čtvrti/města zahrnuje novostavby (×1,15) a renovované
    // (×1,08) — nejsilnější segment, který průměr tlačí nad úroveň běžného fondu.
    // Byt v běžném stavu („good") je proto pod průměrem čtvrti (K Lučinám vs. Valuo:
    // 160k průměr Žižkova vs. ~130k běžný stav). Srážka jen pro čtvrti/obce —
    // na krajské hladině je mix vyrovnanější.
    // mixSkew 0,94 → 0,97: průměr čtvrti/obce sice obsahuje novostavby a renovované,
    // ale už ne dvoucifernou srážku — spolu s panel 0,85 a rokem by se odhad propadl
    // hluboko pod trh (K Lučinám: 0,75×0,98×0,94 = 0,69 vs. Valuo 0,81).
    const mixSkew = condition === "good" && (realized.entityType === "ward" || realized.entityType === "municipality");
    if (mixSkew) {
      realizedAdj *= 0.97;
    }
    // nejpřesnější dostupná úroveň: čtvrť > obec > okres > kraj
    let levelLabel =
      realized.entityType === "ward"
        ? `Realizované prodeje — čtvrť ${realized.wardName ?? ""}`
        : realized.entityType === "municipality"
          ? `Realizované prodeje — ${realized.localityName ?? "město"}`
          : realized.entityType === "district"
            ? `Realizované prodeje — okres (${realized.districtName ?? ""})`
            : `Realizované prodeje — ${realized.regionName}`;
    // Transparentnost: když se surový průměr koriguje (cap/shrink/stav), UI ukáže proč
    // je hodnota jiná než surová v tabulce srovnatelných (Kyje: 100k zdroj vs. 145k raw).
    const labelSuffix = [
      realizedCapped ? "omezeno cenovkou" : null,
      shrinkToRegion ? "korigováno" : null,
      mixSkew ? "běžný stav" : null,
    ].filter(Boolean);
    if (labelSuffix.length > 0) levelLabel += ` (${labelSuffix.join(" · ")})`;
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
      note: `${levelNote} Upraveno multiplikátory stav/typ.${shrinkToRegion ? " Čtvrťový průměr je nad krajským o více než 35 % — korigováno směrem ke krajské hladině (novostavby)." : ""}${mixSkew ? " Srážka za běžný stav — průměr čtvrti/města tlačí nahoru novostavby a renovované." : ""}${realizedCapped ? " Referenční hladina byla nad cenovkou inzerátu (zkreslení novostavbami/malým vzorkem) — omezena na 105 % nabídkové ceny." : ""}`,
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
      // Horní hranice +15 % (bylo ±20 %): nabídkové ceny běžně sedí 5–15 % nad
      // transakční hladinou — širší strop by nechal horké nabídky (Kyje: panelové
      // kompy ~127k vs. realizovaná reference 100k) tahat odhad nad úroveň Valuo.
      // Spodní hranice −20 % zůstává (levné inzeráty stále nesmí tlačit dolů).
      const band = { low: 0.8 * realizedAdj, high: 1.15 * realizedAdj };
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

  if (askingPerSqmBlock != null) {
    // Kotva je asymetrická — má odhad táhnout DOLŮ, když je čtvrťový průměr nafouknutý
    // novostavbami. Aby předražený inzerát (vyjednávání proti majiteli) odhad netáhl
    // nahoru, vynecháme kotvu, když je cenovka o víc než 40 % nad tržním blendem
    // (realizované + nabídky).
    const marketLevel = weightTotal > 0 ? weightedSum / weightTotal : null;
    const withinBand = marketLevel == null || askingPerSqmBlock <= marketLevel * 1.4;
    if (withinBand) {
      // Cenovka inzerátu jako třetí zdroj — aktuální tržní signál přímo na tuto nemovitost.
      // Nepřejímá multiplikátory stavu/typu (jsou už v ceně bytu zahrnuté) a ruší plošnou
      // úpravu plochy/dopravy (vztahuje se k tomuto konkrétnímu bytu), proto ji de-skálujeme
      // před závěrečným násobením areaFactor × transportMult.
      const scale = Math.max(0.1, areaFactor * transportMult);
      sources.push({
        key: "asking",
        label: "Cenovka inzerátu (kotva)",
        pricePerSqm: Math.round(askingPerSqmBlock),
        sampleSize: 1,
        weight: VALUATION_WEIGHTS.asking,
        note: `Nabídková cena inzerátu (${Math.round(askingPerSqmBlock / 1000)} tis. Kč/m²) — aktuální tržní signál přímo na tuto nemovitost.`,
      });
      weightedSum += (askingPerSqmBlock / scale) * VALUATION_WEIGHTS.asking;
      weightTotal += VALUATION_WEIGHTS.asking;
    }
  }

  // ---------- 3) Odhad ----------
  let pricePerSqm: number | null = null;
  // spread dle kvality dat: čtvrť/obec = nejužší (±5–6 % jako Valuo), kraj = širší
  let spread = 0.08;
  if (weightTotal > 0) {
    pricePerSqm = (weightedSum / weightTotal) * areaFactor * transportMult;
    if (realized) {
      if (realized.entityType === "ward") spread -= 0.025;
      else if (realized.entityType === "municipality") spread -= 0.02;
      else if (realized.entityType === "district") spread -= 0.01;
      // Malý vzorek čtvrti = velká nejistota (Kyje: 29 tx zamořených novostavbami).
      // Valuo u takových lokalit ukazuje široké rozmezí ±17 % — my musíme být skromnější
      // než ±8,5 %; pod 100 tx přidáme +2 p.b., pod 1000 tx +1 p.b.
      if (realized.numTransactions < 100) spread += 0.02;
      else if (realized.numTransactions < 1000) spread += 0.01;
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
  if (input.transport && input.transport.sampleSize >= 3) confidenceScore += 4;
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
        // Realizované prodeje z vlastní historie (párování zmizelých inzerátů)
        // se zobrazí jako „realizované prodeje" místo „nabídka".
        source: s.realized ? ("realized" as const) : ("offer" as const),
        condition: s.condition ?? null,
        soldAt: s.realized ? s.soldAt ?? null : null,
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
  const multParts: string[] = [];
  if (condition) multParts.push(`stav ${conditionMultiplier(condition).toFixed(2)}×`);
  if (buildingType) multParts.push(`konstrukce ${buildingTypeMultiplier(buildingType).toFixed(2)}×`);
  if (category) multParts.push(`lokalita ${categoryMultiplier(category).toFixed(2)}×`);
  if (input.ownership) multParts.push(`vlastnictví ${ownershipMultiplier(input.ownership).toFixed(2)}×`);
  if (input.floor != null) multParts.push(`patro ${floorMultiplier(input.floor, input.totalFloors, input.elevator).toFixed(2)}×`);
  if (input.yearBuilt) multParts.push(`rok ${yearBuiltMultiplier(input.yearBuilt).toFixed(2)}×`);
  if (input.balconyArea && input.balconyArea > 0) multParts.push(`balkón ${balconyMultiplier(input.balconyArea).toFixed(2)}×`);
  if (input.gardenArea && input.gardenArea > 0) multParts.push(`zahrada ${gardenMultiplier(input.gardenArea).toFixed(2)}×`);
  if (input.cellarArea && input.cellarArea > 0) multParts.push(`sklep ${cellarMultiplier(input.cellarArea).toFixed(2)}×`);
  methodology.push(
    `Úprava plochy ${areaFactor.toFixed(2)}× (menší jednotky = vyšší Kč/m²); multiplikátory: ${multParts.length ? multParts.join(", ") : "žádné"} (celkem ${mult.toFixed(2)}×).`
  );
  if (askingPerSqmBlock != null) {
    methodology.push(
      `Cenovka inzerátu (kotva, váha ${Math.round(VALUATION_WEIGHTS.asking * 100)} %): ${Math.round(askingPerSqmBlock).toLocaleString("cs-CZ")} Kč/m² — aktuální nabídková cena přímo na tuto nemovitost, ukotvuje odhad k dnešnímu trhu.`
    );
  }
  if (input.asOfDate) {
    methodology.push(`Odhad k datu ${input.asOfDate}: okno realizovaných prodejů končí zvoleným měsícem (zpětný odhad).`);
  }
  if (input.lookbackMonths) {
    methodology.push(`Období dat: posledních ${input.lookbackMonths} měsíců realizovaných prodejů.`);
  }
  if (input.transport && input.transport.sampleSize >= 3) {
    const parts = [
      input.transport.metroDistance != null ? `metro ${fmtDist(input.transport.metroDistance)}` : null,
      input.transport.trainDistance != null ? `vlak ${fmtDist(input.transport.trainDistance)}` : null,
      input.transport.busDistance != null ? `bus ${fmtDist(input.transport.busDistance)}` : null,
    ].filter(Boolean);
    methodology.push(
      `Doprava (Vlak Index): ${parts.join(", ") || "bez dat"} → skóre ${input.transport.score}/100 → úprava ${transportMult > 1 ? "+" : ""}${Math.round((transportMult - 1) * 1000) / 10} % na cenu za m².${input.transport.premiumPct != null ? ` V tomto městě dosahují dopravně výborné lokality prémie ${input.transport.premiumPct > 0 ? "+" : ""}${input.transport.premiumPct} % (z reálných inzerátů).` : ""}`
    );
  }
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
    transport: input.transport ?? null,
    methodology,
    generatedAt: now,
  };
}

/** Formátování vzdálenosti (m) — pod 1000 m v metrech, jinak v km. */
function fmtDist(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km`;
}

/** Dopočte trend z cenové mapy a vloží do výsledku (UI vrstva). */
export function attachTrend(result: ValuationResult, trend: { monthYear: string; price: number }[]): ValuationResult {
  return { ...result, trend };
}

/** Najde cenu v trendu pro daný měsíc (YYYY-MM) s lineární interpolací mezi sousedy. */
function trendPriceAt(trend: { monthYear: string; price: number }[], asOf: string): number | null {
  // formát bodů: "2026/07" nebo "07/2026"
  const mAsOf = asOf.match(/^(\d{4})-(\d{2})$/);
  if (!mAsOf) return null;
  const target = new Date(`${asOf}-01T00:00:00Z`);
  const pts = trend
    .map((t) => {
      const m = t.monthYear.match(/^(\d{4})\/(\d{2})$|^(\d{2})\/(\d{4})$/);
      if (!m) return null;
      const y = m[1] ? Number(m[1]) : Number(m[4]);
      const mo = m[2] ? Number(m[2]) : Number(m[3]);
      return { ts: Date.UTC(y, mo - 1, 1), price: t.price };
    })
    .filter((p): p is { ts: number; price: number } => p != null && p.price > 0)
    .sort((a, b) => a.ts - b.ts);
  if (pts.length === 0) return null;
  const targetTs = target.getTime();
  const before = [...pts].reverse().find((p) => p.ts <= targetTs);
  const after = pts.find((p) => p.ts >= targetTs);
  if (!before && after) return after.price;
  if (before && !after) return before.price;
  if (before && after && before.ts === after.ts) return before.price;
  if (before && after) {
    const ratio = (targetTs - before.ts) / (after.ts - before.ts);
    return before.price + (after.price - before.price) * ratio;
  }
  return null;
}

/**
 * Zpětný odhad „k datu" — přepočte odhad na cenu v minulém měsíci podle trendu
 * realizovaných cen (Seznam cenová mapa). Čistá funkce (testovatelná); bez trendu
 * nebo při nevalidním datu vrací výsledek beze změny.
 */
export function scaleToDate(
  result: ValuationResult,
  asOfDate: string | null | undefined,
  trend: { monthYear: string; price: number }[]
): ValuationResult {
  if (!asOfDate || !/^\d{4}-\d{2}$/.test(asOfDate)) return result;
  const atAsOf = trendPriceAt(trend, asOfDate);
  // nejnovější bod trendu — cena, ke které je odhad počítán „dnes".
  // Body parsujeme a bereme max ts — nezávisle na pořadí pole trendu.
  let latest: number | null = null;
  let latestTs = -1;
  for (const t of trend) {
    const m = t.monthYear.match(/^(\d{4})\/(\d{2})$|^(\d{2})\/(\d{4})$/);
    if (!m || typeof t.price !== "number" || t.price <= 0) continue;
    const y = m[1] ? Number(m[1]) : Number(m[4]);
    const mo = m[2] ? Number(m[2]) : Number(m[3]);
    const ts = Date.UTC(y, mo - 1, 1);
    if (ts > latestTs) {
      latestTs = ts;
      latest = t.price;
    }
  }
  if (!atAsOf || !latest || latest <= 0) return result;
  const factor = atAsOf / latest;
  // rozumné meze — trend nesmí odhad otočit o víc než ±40 %
  if (factor <= 0.6 || factor >= 1.4) return result;
  const scale = (n: number) => Math.round(n * factor);
  const estimate = scale(result.estimate);
  const askingPrice = result.askingPrice ?? null;
  return {
    ...result,
    estimate,
    low: scale(result.low),
    high: scale(result.high),
    pricePerSqm: scale(result.pricePerSqm),
    lowPerSqm: scale(result.lowPerSqm),
    highPerSqm: scale(result.highPerSqm),
    // přepočtený odhad k datu → srovnání s inzerátem je zastaralé (inzerát je „dnes")
    vsAskingPct: null,
    methodology: [...result.methodology, `Zpětný přepočet k datu ${asOfDate}: ceny indexovány faktorem ${(factor * 100).toFixed(1)} % dle trendu realizovaných prodejů.`],
  };
}
