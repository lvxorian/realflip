/**
 * Live smoke test modulu Odhad — Cheb s drill-downem na městskou úroveň.
 * Spustit: npx tsx scripts/valuation-check.ts
 */
import { regionKeyForCity, getRealizedLocalityForCity } from "../src/lib/valuation/price-map";
import { estimateProperty } from "../src/lib/valuation/engine";
import { fetchComparableSamples } from "../src/lib/scraping/market-price-service";

async function main() {
  console.log("regionKeyForCity(cheb):", regionKeyForCity("cheb"));

  const realized = await getRealizedLocalityForCity("cheb");
  console.log(
    "realizované pro Cheb (drill-down):",
    realized
      ? JSON.stringify({
          level: realized.entityType,
          locality: realized.localityName,
          district: realized.districtName,
          avg: realized.avgPricePerSqm,
          tx: realized.numTransactions,
          region: realized.regionName,
        })
      : "NULL"
  );

  const result = await estimateProperty(
    {
      cityKey: "cheb",
      cityName: "Cheb",
      type: "flat",
      disposition: "3+1",
      area: 70,
      condition: "good",
      buildingType: "brick",
      lat: 50.0803,
      lng: 12.3736,
      askingPrice: 2990000,
    },
    { getRealized: getRealizedLocalityForCity, getComps: fetchComparableSamples }
  );

  console.log("\n=== Odhad ===");
  console.log("odhad:", result.estimate, "| rozmezí:", result.low, "-", result.high);
  console.log("Kč/m²:", result.pricePerSqm, "| rozmezí m²:", result.lowPerSqm, "-", result.highPerSqm);
  console.log("confidence:", result.confidenceLabel, result.confidenceScore);
  console.log("sources:", result.sources.map((s) => `${s.label} (${s.pricePerSqm} Kč/m², váha ${s.weight})`));
  console.log("\n=== Komparace ===");
  for (const c of result.comparables) {
    console.log(`- [${c.source}] ${c.label} | ${c.pricePerSqm} Kč/m² | ${c.distanceKm ? c.distanceKm.toFixed(1) + " km" : "—"}`);
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
