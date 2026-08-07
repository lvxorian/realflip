/**
 * Živá kontrola modulu Odhad:
 *  1) getRealizedLocalityForCity("praha", { address, wardHints }) → čtvrť Žižkov místo kraje
 *  2) getRealizedLocalityForCity("cheb") → město Cheb (regresní kontrola)
 *  3) estimateProperty pro reálný byt K Lučinám, Praha 3-Žižkov (73 m², 3+1, průměrný stav)
 */
import { getRealizedLocalityForCity } from "../src/lib/valuation/price-map";
import { estimateProperty } from "../src/lib/valuation/engine";
import { clearCache, refreshMarketData } from "../src/lib/scraping/market-price-service";
import type { ValuationInput } from "../src/lib/valuation/types";

async function main() {
  clearCache();
  await refreshMarketData("praha").catch(() => {});
  // 1) Praha → čtvrť Žižkov (jako Valuo: přesná adresa)
  const praha = await getRealizedLocalityForCity("praha", {
    address: "K Lučinám, Praha 3-Žižkov, Praha",
    wardHints: ["Žižkov", "Praha 3"],
  });
  console.log("\n=== Praha (K Lučinám, Žižkov) ===");
  console.log(
    praha
      ? `úroveň: ${praha.entityType} · ${praha.wardName ?? praha.localityName ?? praha.regionName} · ${praha.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² (${praha.numTransactions.toLocaleString("cs-CZ")} tx) · kraj ${praha.regionAvgPricePerSqm.toLocaleString("cs-CZ")}`
      : "NEPŘÍSTUPNÉ"
  );

  // 2) Cheb (regrese)
  const cheb = await getRealizedLocalityForCity("cheb");
  console.log("\n=== Cheb ===");
  console.log(
    cheb
      ? `úroveň: ${cheb.entityType} · ${cheb.localityName ?? cheb.districtName ?? cheb.regionName} · ${cheb.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² (${cheb.numTransactions.toLocaleString("cs-CZ")} tx)`
      : "NEPŘÍSTUPNÉ"
  );

  // 3) kompletní odhad pro byt z valuo.cz srovnání
  const input: ValuationInput = {
    cityKey: "praha",
    cityName: "Praha",
    address: "K Lučinám, Praha 3-Žižkov, Praha",
    type: "flat",
    disposition: "3+1",
    area: 73,
    condition: "good",
    lat: 50.084,
    lng: 14.478,
    wardHints: ["Žižkov", "Praha 3"],
  };
  const r = await estimateProperty(input);
  console.log("\n=== Odhad bytu (73 m², Žižkov) ===");
  console.log(`Odhad: ${(r.estimate / 1_000_000).toFixed(3)} mil. Kč · ${r.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²`);
  console.log(`Rozmezí: ${(r.low / 1_000_000).toFixed(3)} – ${(r.high / 1_000_000).toFixed(3)} mil. Kč (${Math.round(((r.high - r.low) / (2 * r.estimate)) * 100)} %)`);
  console.log(`Confidence: ${r.confidenceScore}/100 · ${r.confidenceLabel}`);
  for (const s of r.sources)
    console.log(`  zdroj: ${s.label} · ${s.pricePerSqm.toLocaleString("cs-CZ")} Kč/m² · váha ${Math.round(s.weight * 100)} % · vzorků ${s.sampleSize ?? "—"}`);
  console.log("  komparace (realizované):");
  for (const c of r.comparables.filter((c) => c.source === "realized")) {
    console.log(`    ${c.label}: ${c.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²`);
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
