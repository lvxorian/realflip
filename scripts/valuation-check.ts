/**
 * Live smoke test modulu Odhad — Cheb.
 * Ověřuje: (1) regionKeyForCity("cheb") → karlovarsky, (2) realizované prodeje z cenové mapy,
 * (3) engine odhad + komparace bez vzorků z cizích měst.
 * Spustit: npx tsx scripts/valuation-check.ts
 */
import { regionKeyForCity, getRealizedRegionForCity } from "../src/lib/valuation/price-map";
import { estimateProperty } from "../src/lib/valuation/engine";
import { fetchComparableSamples } from "../src/lib/scraping/market-price-service";

async function main() {
  const region = regionKeyForCity("cheb");
  console.log("regionKeyForCity(cheb):", region);

  const realized = await getRealizedRegionForCity("cheb");
  console.log("realizované pro Cheb:", realized ? JSON.stringify(realized) : "NULL");

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
    { getRealized: getRealizedRegionForCity, getComps: fetchComparableSamples }
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
  const foreign = result.comparables.filter(
    (c) => c.source === "offer" && c.label && !/cheb|chebsk/i.test(c.label)
  );
  console.log("\nkompy z cizích měst:", foreign.length, foreign.map((c) => c.label));
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
