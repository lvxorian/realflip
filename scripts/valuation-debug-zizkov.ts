/**
 * Diagnostika odhadu K Lučinám 2469/21, Žižkov (Praha 3) — uživatelův přesný inzerát.
 * Spustit: npx tsx scripts/valuation-debug-zizkov.ts
 *
 * Načte listing přes scrapeUrl (přesné pole inzerátu: cena, plocha, stav, patro, GPS…),
 * pak replikuje engine.ts krok po kroku a tiskne každý mezikrok, aby bylo vidět,
 * co odhad tlačí nahoru/dolů oproti Valuo (129 385 Kč/m²).
 */
import { scrapeUrl } from "../src/lib/scraping/url-scraper";
import { applyAreaResolution } from "../src/lib/scraping/area-resolver";
import {
  getRealizedLocalityForCity,
  fetchWardTransactions,
} from "../src/lib/valuation/price-map";
import { getPropertyMarketRange } from "../src/lib/scraping/market-price-service";
import {
  conditionMultiplier,
  buildingTypeMultiplier,
  ownershipMultiplier,
  floorMultiplier,
  balconyMultiplier,
  gardenMultiplier,
  cellarMultiplier,
  categoryMultiplier,
} from "../src/lib/analysis/market-data";
import { classifyLocation } from "../src/lib/analysis/location";
import { areaSizeFactor, transportMultiplier, timeIndexFactor, yearBuiltMultiplier } from "../src/lib/valuation/engine";

const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

const URL = "https://www.sreality.cz/detail/prodej/byt/3+1/praha-zizkov-k-lucinam/3498889292";
const TARGET_PER_SQM = 129385; // Valuo: 9 315 720 Kč / 72 m² (Valuo počítá 72 m²)

async function main() {
  console.log("==================== KROK 0: INZERÁT ====================");
  const { listing: rawListing } = await scrapeUrl(URL);
  const { resolved: listing } = applyAreaResolution(rawListing);
  console.log(`titulek: ${listing.title}`);
  console.log(`adresa: ${listing.address}`);
  console.log(`cena: ${fmt(listing.price)} Kč | plocha: ${listing.area} m² | rooms: ${listing.rooms}`);
  console.log(`condition: ${listing.condition} | buildingType: ${listing.buildingType} | ownership: ${listing.ownership}`);
  console.log(`floor: ${listing.floor} | totalFloors: ${listing.totalFloors} | elevator: ${listing.elevator} | yearBuilt: ${listing.yearBuilt}`);
  console.log(`balcony: ${listing.balconyArea} | garden: ${listing.gardenArea} | cellar: ${listing.cellarArea}`);
  console.log(`lat: ${listing.lat} | lng: ${listing.lng}`);
  const location = classifyLocation(listing.address, listing.title);
  console.log(`cityKey: ${location.city} | category: ${location.category}`);

  const input = {
    cityKey: location.city !== "Neznámá" ? location.city : "praha",
    address: listing.address ?? "K Lučinám, Praha 3",
    wardHints: ["Žižkov"],
    type: "flat" as const,
    area: listing.area ?? 73,
    condition: listing.condition ?? "renovated",
    buildingType: listing.buildingType ?? "panel",
    floor: listing.floor ?? 1,
    totalFloors: listing.totalFloors ?? 8,
    elevator: listing.elevator ?? true,
    yearBuilt: listing.yearBuilt ?? null,
    ownership: listing.ownership ?? "personal",
    balconyArea: listing.balconyArea ?? null,
    gardenArea: listing.gardenArea ?? null,
    cellarArea: listing.cellarArea ?? null,
    askingPrice: listing.price ?? 8_999_000,
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
    lookbackMonths: 6, // Praha (liquid) → 6M okno
  };

  const askingPerSqm = input.askingPrice / input.area;
  console.log(`\ncenovka inzerátu: ${fmt(askingPerSqm)} Kč/m² (${fmt(input.askingPrice)} Kč)`);

  const segAny = !input.condition || !input.buildingType;
  const catMult = categoryMultiplier(location.category);
  console.log(`\n==================== KROK 0.5: NABÍDKY (fetch předem pro BUG 9) ====================`);
  const range = await getPropertyMarketRange({
    cityKey: input.cityKey,
    lat: input.lat ?? undefined,
    lng: input.lng ?? undefined,
    condition: input.condition,
    buildingType: input.buildingType,
    area: input.area,
  });
  if (range) {
    console.log(`source: ${range.source} | median: ${fmt(range.median)} | low: ${fmt(range.low)} | high: ${fmt(range.high)} | vzorků: ${range.sampleSize}`);
  } else {
    console.log("range: null");
  }

  console.log("\n==================== KROK 1: REALIZOVANÉ ====================");
  const realized = await getRealizedLocalityForCity(input.cityKey, {
    address: input.address,
    wardHints: input.wardHints,
    lat: input.lat ?? undefined,
    lng: input.lng ?? undefined,
    lookbackMonths: input.lookbackMonths,
  });
  if (!realized) {
    console.log("realized: null");
    return;
  }
  console.log(`entityType: ${realized.entityType}, úroveň: ${realized.wardName ?? realized.localityName ?? realized.districtName ?? realized.regionName}`);
  console.log(`RAW průměr: ${fmt(realized.avgPricePerSqm)} Kč/m² (${realized.numTransactions} tx)`);
  console.log(`region průměr: ${fmt(realized.regionAvgPricePerSqm)} Kč/m² | okres: ${fmt(realized.districtAvgPricePerSqm)} | obec: ${fmt(realized.localityAvgPricePerSqm)}`);
  console.log(`perioda: ${realized.period}`);
  const trend = realized.trend ?? [];
  const sortedTrend = [...trend].sort((a, b) => a.monthYear.localeCompare(b.monthYear));
  for (const t of sortedTrend.slice(-6)) console.log(`  ${t.monthYear}: ${fmt(t.price)}`);

  const timeFactor = timeIndexFactor(realized.period, trend);
  console.log(`timeIndexFactor (střed okna → dnešek): ×${timeFactor.toFixed(4)}`);

  const indexedWard = realized.avgPricePerSqm * timeFactor;
  const indexedRegion = realized.regionAvgPricePerSqm * timeFactor;
  console.log(`indexovaná čtvrť: ${fmt(realized.avgPricePerSqm)} × ${timeFactor.toFixed(4)} = ${fmt(indexedWard)}`);

  // cap na cenovku
  const askingCap = askingPerSqm >= indexedWard * 0.75 ? askingPerSqm * 1.05 : null;
  const capApplied = askingCap != null && indexedWard > askingCap;
  console.log(`cap 1.05×cenovka: ${fmt(askingCap)} | cap aplikován: ${capApplied ? "ANO" : "ne"} | guard 0.75×indexed: ${fmt(indexedWard * 0.75)}`);
  let realizedRef = capApplied ? askingCap! : indexedWard;

  // BUG 9 — offers cap: ward nad 1,2× nabídkový medián segmentu → omezení reference
  let offeredCapped = false;
  if (range && (range.source === "db" || range.source === "sreality") && range.median > 0 && realized.entityType === "ward") {
    const offerMedianForWard = segAny ? range.median / catMult : range.median;
    if (indexedWard > 1.2 * offerMedianForWard) {
      const offersCap = 1.2 * offerMedianForWard;
      if (offersCap < realizedRef) {
        realizedRef = offersCap;
        offeredCapped = true;
      }
    }
  }
  console.log(`offers cap (BUG 9): ${offeredCapped ? `ANO → 1,2×nabídky = ${fmt(realizedRef)}` : "ne"} (ward > 1,2×nabídky: ${indexedWard > 1.2 * (range ? (segAny ? range.median / catMult : range.median) : 0)})`);
  console.log(`realizedRef (po capu): ${fmt(realizedRef)}`);

  // shrink na kraj
  const regionRatio = indexedWard / Math.max(1, indexedRegion);
  const shrinkToRegion = (realized.entityType === "ward" || realized.entityType === "municipality") && regionRatio > 1.35;
  console.log(`poměr čtvrť/kraj: ${regionRatio.toFixed(3)} | shrinkToRegion: ${shrinkToRegion ? "ANO" : "ne"}`);

  // multiplikátory
  const baseMult =
    conditionMultiplier(input.condition) *
    buildingTypeMultiplier(input.buildingType) *
    ownershipMultiplier(input.ownership) *
    floorMultiplier(input.floor, input.totalFloors, input.elevator) *
    yearBuiltMultiplier(input.yearBuilt) *
    balconyMultiplier(input.balconyArea) *
    gardenMultiplier(input.gardenArea) *
    cellarMultiplier(input.cellarArea);
  console.log(`mult: stav ${conditionMultiplier(input.condition)} × konstrukce ${buildingTypeMultiplier(input.buildingType)} × vlastnictví ${ownershipMultiplier(input.ownership)} × patro ${floorMultiplier(input.floor, input.totalFloors, input.elevator)} × rok ${yearBuiltMultiplier(input.yearBuilt)} = ${baseMult.toFixed(4)}`);

  const rawMult = baseMult * (realized.entityType === "ward" ? 1 : categoryMultiplier(location.category));
  const mult = Math.min(1.6, Math.max(0.5, rawMult));
  console.log(`mult po clamp [0.5,1.6]: ${mult.toFixed(4)}`);

  let realizedAdj = realizedRef * mult;
  if (shrinkToRegion) {
    const shrinkRef = 0.75 * indexedWard + 0.25 * indexedRegion;
    realizedAdj = Math.min(realizedRef, shrinkRef) * mult;
    console.log(`shrinkRef: ${fmt(shrinkRef)} → realizedAdj: ${fmt(realizedAdj)}`);
  }
  const mixSkew = input.condition === "good" && (realized.entityType === "ward" || realized.entityType === "municipality");
  if (mixSkew) realizedAdj *= 0.97;
  console.log(`mixSkew (běžný stav): ${mixSkew ? "×0.97" : "ne"}`);
  console.log(`realizedAdj FINAL: ${fmt(realizedAdj)} Kč/m²  (vs. Valuo ${fmt(TARGET_PER_SQM)})`);

  console.log("\n==================== KROK 2: NABÍDKY (detail) ====================");
  if (range) {
    let offerMedian = range.median;
    if (realized?.entityType === "ward" && segAny && catMult !== 1) {
      offerMedian = range.median / catMult;
      console.log(`  de-aplikace category ${catMult}× → ${fmt(offerMedian)}`);
    }
    const band = { low: 0.8 * realizedAdj, high: 1.15 * realizedAdj };
    console.log(`clamp band: [${fmt(band.low)}, ${fmt(band.high)}]`);
    if (offerMedian < band.low) { offerMedian = band.low; console.log("  → clamped DOLŮ"); }
    else if (offerMedian > band.high) { offerMedian = band.high; console.log("  → clamped NAHORU"); }
    else console.log("  → v pásmu, bez clampu");
    const sourceQuality = range.source === "db" || range.source === "sreality" ? 1 : range.source === "market_data" ? 0.6 : 0.3;
    const sampleFactor = range.source === "db" || range.source === "sreality" ? Math.min(1, (range.sampleSize || 0) / 8) : 1;
    const weight = 0.35 * sourceQuality * sampleFactor;
    console.log(`váha nabídek: 0.35 × ${sourceQuality} × ${sampleFactor.toFixed(2)} = ${weight.toFixed(3)}`);
    console.log(`offers FINAL: ${fmt(offerMedian)} Kč/m²`);
  }

  console.log("\n==================== KROK 3: BLEND ====================");
  const areaFactor = areaSizeFactor(input.area);
  const transportMult = transportMultiplier(65);
  const scale = Math.max(0.1, areaFactor * transportMult);
  console.log(`areaFactor (${input.area} m²): ${areaFactor.toFixed(4)} | transportMult (65/100): ${transportMult.toFixed(4)} | scale: ${scale.toFixed(4)}`);

  const wRealized = 0.45, wAsking = 0.1;
  const wOffers = range ? 0.35 * (range.source === "db" || range.source === "sreality" ? 1 : range.source === "market_data" ? 0.6 : 0.3) * (range.source === "db" || range.source === "sreality" ? Math.min(1, (range.sampleSize || 0) / 8) : 1) : 0;
  let sum = realizedAdj * wRealized;
  let wTotal = wRealized;
  let offersF = null;
  if (range && range.median > 0) {
    const band = { low: 0.8 * realizedAdj, high: 1.15 * realizedAdj };
    offersF = Math.min(band.high, Math.max(band.low, range.median));
    sum += offersF * wOffers;
    wTotal += wOffers;
    console.log(`realized × 0.45 = ${fmt(realizedAdj * wRealized)} | offers × ${wOffers.toFixed(3)} = ${fmt(offersF * wOffers)}`);
  }
  const marketLevel = wTotal > 0 ? sum / wTotal : null;
  const withinBand = marketLevel == null || askingPerSqm <= marketLevel * 1.4;
  console.log(`marketLevel (bez kotvy): ${fmt(marketLevel)} | asking ≤ 1.4×blend: ${withinBand ? "ANO" : "ne"}`);
  if (withinBand) {
    sum += (askingPerSqm / scale) * wAsking;
    wTotal += wAsking;
    console.log(`asking/scale × 0.1 = ${fmt((askingPerSqm / scale) * wAsking)}`);
  }
  const pricePerSqm = (sum / wTotal) * areaFactor * transportMult;
  console.log(`blend: ${fmt(sum / wTotal)} → ×areaFactor ×transport = ${fmt(pricePerSqm)} Kč/m²`);
  console.log(`ODHAD: ${fmt(pricePerSqm * input.area, 0)} Kč (${fmt(pricePerSqm)} Kč/m², ${input.area} m²)`);
  console.log(`Valuo: ${fmt(TARGET_PER_SQM)} Kč/m² (9 315 720 Kč / 72 m²)`);
  const diff = (pricePerSqm / TARGET_PER_SQM - 1) * 100;
  console.log(`ROZDÍL: ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} % ${diff > 0 ? "NAD" : "POD"} Valuo`);
}

main().catch((e) => {
  console.error("CHYBA:", e);
  process.exit(1);
});
