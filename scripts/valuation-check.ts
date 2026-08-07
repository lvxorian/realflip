/**
 * Live kontrola zdroje realizovaných cen (Seznam cenová mapa).
 * Spuštění: npx tsx scripts/valuation-check.ts
 */
import "./_env";
import { fetchPriceMap, getRealizedRegionForCity } from "../src/lib/valuation/price-map";

(async () => {
  const data = await fetchPriceMap(true);
  if (!data) {
    console.log("PRICE MAP: selhání (null)");
    process.exit(1);
  }
  console.log(`Regions: ${data.regions.length}, total transactions: ${data.totalTransactions.toLocaleString("cs-CZ")}`);
  console.log(`Period: ${data.dateFrom} → ${data.dateTo}, trend points: ${data.trend.length}`);
  for (const r of data.regions.slice(0, 6)) {
    console.log(`  ${r.name}: ${r.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² (${r.numTransactions.toLocaleString("cs-CZ")} tx)`);
  }
  for (const city of ["praha", "brno", "plzen", "usti"]) {
    const c = await getRealizedRegionForCity(city);
    console.log(`${city}: ${c ? `${c.avgPricePerSqm.toLocaleString("cs-CZ")} Kč/m² (${c.numTransactions.toLocaleString("cs-CZ")} tx, ${c.regionName})` : "žádná data"}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
