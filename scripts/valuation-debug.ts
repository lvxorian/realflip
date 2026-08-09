/**
 * Diagnostika odhadu Kyje (Travná) — uživatelovy přesné vstupy.
 * Spustit: npx tsx scripts/valuation-debug.ts
 *
 * Replikuje výpočet engine.ts krok po kroku a tiskne každý mezikrok,
 * aby bylo vidět, co odhad tlačí nahoru/dolů oproti Valuo (102 381 Kč/m²).
 * POZOR: ruční replika engine logiky — při změnách engine.ts je potřeba
 * aktualizovat i tento skript (neautoritativní, jen pro ladění).
 */
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
} from "../src/lib/analysis/market-data";
import { areaSizeFactor, transportMultiplier, timeIndexFactor, yearBuiltMultiplier } from "../src/lib/valuation/engine";

const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

async function main() {
  // ===== Uživatelův vstup =====
  const input = {
    cityKey: "praha",
    address: "Travná, Praha - Kyje, Praha",
    wardHints: ["Kyje", "Jahodnice"],
    type: "flat" as const,
    area: 77,
    condition: "renovated", // Po rekonstrukci
    buildingType: "panel", // Kyje = panelový fond (ověřeno: bez 0.85 nevychází 107 904)
    floor: 3,
    totalFloors: 5,
    elevator: false, // bez výtahu
    ownership: "personal",
    askingPrice: 8_920_000, // anchor 115 844 Kč/m²
    lat: 50.0945,
    lng: 14.542,
    lookbackMonths: 6, // Praha (liquid) → 6M okno
  };
  const target = 102381; // Valuo: 7 883 337 / 77 m²

  console.log("==================== KROK 1: REALIZOVANÉ ====================");
  const realized = await getRealizedLocalityForCity(input.cityKey, {
    address: input.address,
    wardHints: input.wardHints,
    lat: input.lat,
    lng: input.lng,
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
  console.log(`trend bodů: ${realized.trend?.length ?? 0}`);
  const trend = realized.trend ?? [];
  const sortedTrend = [...trend].sort((a, b) => a.monthYear.localeCompare(b.monthYear));
  for (const t of sortedTrend.slice(-6)) console.log(`  ${t.monthYear}: ${fmt(t.price)}`);

  const timeFactor = timeIndexFactor(realized.period, trend);
  console.log(`timeIndexFactor (střed okna → dnešek): ×${timeFactor.toFixed(4)}`);

  // indexace PŘED capem — cenovka je cena „dnes", surový průměr je střed okna
  const indexedWard = realized.avgPricePerSqm * timeFactor;
  const indexedRegion = realized.regionAvgPricePerSqm * timeFactor;
  console.log(`indexovaná čtvrť: ${fmt(realized.avgPricePerSqm)} × ${timeFactor.toFixed(4)} = ${fmt(indexedWard)}`);

  // cap na cenovku (indexovaná čtvrť vs. dnešní cenovka)
  const askingPerSqm = input.askingPrice / input.area;
  const askingCap = askingPerSqm >= indexedWard * 0.75 ? askingPerSqm * 1.05 : null;
  const capApplied = askingCap != null && indexedWard > askingCap;
  console.log(`cenovka: ${fmt(askingPerSqm)} Kč/m² | cap 1.05×cenovka: ${fmt(askingCap)} | cap aplikován: ${capApplied ? "ANO" : "ne"}`);
  const realizedRef = capApplied ? askingCap! : indexedWard;
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
  console.log(`mult: stav ${conditionMultiplier(input.condition)} × konstrukce ${buildingTypeMultiplier(input.buildingType)} × vlastnictví ${ownershipMultiplier(input.ownership)} × patro ${floorMultiplier(input.floor, input.totalFloors, input.elevator)} = ${baseMult.toFixed(4)}`);

  let realizedAdj = realizedRef * baseMult;
  if (shrinkToRegion) {
    const shrinkRef = 0.75 * realized.avgPricePerSqm + 0.25 * realized.regionAvgPricePerSqm;
    realizedAdj = Math.min(realizedRef, shrinkRef) * baseMult;
    console.log(`shrinkRef: ${fmt(shrinkRef)} → realizedAdj: ${fmt(realizedAdj)}`);
  }
  const mixSkew = input.condition === "good" && (realized.entityType === "ward" || realized.entityType === "municipality");
  if (mixSkew) realizedAdj *= 0.97;
  console.log(`mixSkew (běžný stav): ${mixSkew ? "×0.97" : "ne"} | (indexace už je v indexedWard — dál se nenásobí)`);
  console.log(`realizedAdj FINAL: ${fmt(realizedAdj)} Kč/m²  (vs. Valuo ${fmt(target)})`);

  console.log("\n==================== KROK 2: NABÍDKY ====================");
  const range = await getPropertyMarketRange({
    cityKey: input.cityKey,
    lat: input.lat,
    lng: input.lng,
    condition: input.condition,
    buildingType: input.buildingType,
    area: input.area,
  });
  if (range) {
    console.log(`source: ${range.source} | median: ${fmt(range.median)} | low: ${fmt(range.low)} | high: ${fmt(range.high)} | vzorků: ${range.sampleSize}`);
    const segAny = !input.condition || !input.buildingType;
    const band = { low: 0.8 * realizedAdj, high: 1.15 * realizedAdj };
    console.log(`clamp band: [${fmt(band.low)}, ${fmt(band.high)}]`);
    let offerMedian = range.median;
    if (offerMedian < band.low) { offerMedian = band.low; console.log("  → clamped DOLŮ na band.low"); }
    else if (offerMedian > band.high) { offerMedian = band.high; console.log("  → clamped NAHORU na band.high"); }
    else console.log("  → v pásmu, bez clampu");
    const sourceQuality = range.source === "db" || range.source === "sreality" ? 1 : range.source === "market_data" ? 0.6 : 0.3;
    const sampleFactor = range.source === "db" || range.source === "sreality" ? Math.min(1, (range.sampleSize || 0) / 8) : 1;
    const weight = 0.35 * sourceQuality * sampleFactor;
    console.log(`váha nabídek: 0.35 × ${sourceQuality} × ${sampleFactor.toFixed(2)} = ${weight.toFixed(3)}`);
    console.log(`offers FINAL: ${fmt(offerMedian)} Kč/m²`);
  } else {
    console.log("range: null");
  }

  console.log("\n==================== KROK 3: BLEND ====================");
  const areaFactor = areaSizeFactor(input.area);
  const transportMult = transportMultiplier(71);
  console.log(`areaFactor (77 m²): ${areaFactor.toFixed(4)} | transportMult (71/100): ${transportMult.toFixed(4)}`);
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
    console.log(`realized × 0.45 = ${fmt(sum - 0)} | offers × ${wOffers.toFixed(3)} = ${fmt(offersF * wOffers)}`);
  }
  const scale = Math.max(0.1, areaFactor * transportMult);
  const askingOk = askingPerSqm <= (wTotal > 0 ? sum / wTotal : null) * 1.4;
  if (askingOk) {
    sum += (askingPerSqm / scale) * wAsking;
    wTotal += wAsking;
    console.log(`asking/scale × 0.1 = ${fmt((askingPerSqm / scale) * wAsking)} | scale = ${scale.toFixed(3)}`);
  }
  const pricePerSqm = (sum / wTotal) * areaFactor * transportMult;
  console.log(`blend: ${fmt(sum / wTotal)} → ×areaFactor ×transport = ${fmt(pricePerSqm)} Kč/m²`);
  console.log(`ODHAD: ${fmt(pricePerSqm * input.area, 0)} Kč (${fmt(pricePerSqm)} Kč/m²)`);
  console.log(`Valuo: ${fmt(target)} Kč/m² (7 883 337 Kč)`);
  const diff = (pricePerSqm / target - 1) * 100;
  console.log(`ROZDÍL: ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} % ${diff > 0 ? "NAD" : "POD"} Valuo`);
}

main().catch((e) => {
  console.error("CHYBA:", e);
  process.exit(1);
});
