import "./_env";
import { db } from "../src/db";
import { properties, propertyAnalysis } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { refreshLocalityCities, distinctActiveCityKeys } from "../src/lib/locality";

async function main() {
  console.log("=== RealFlip Locality Data Refresh ===\n");

  const cityKeys = await distinctActiveCityKeys();
  console.log(`Active cities: ${cityKeys.length} (${cityKeys.join(", ") || "none"})\n`);

  const { ok, failed } = await refreshLocalityCities(cityKeys);
  console.log(`\nRefreshed CZSO metrics: ${ok} city-metrics, failed sources: ${failed}`);

  // Renty + doprava per city
  for (const city of cityKeys.filter((c) => c && c !== "Neznámá" && c !== "unknown")) {
    try {
      const { refreshRentMetrics } = await import("../src/lib/locality/rent");
      const rent = await refreshRentMetrics(city);
      console.log(`  [${city}] rent: ${rent ? `${rent.rentPerSqm} Kc/m2 (${rent.sampleSize} vzorku)` : "bez dat"}`);
    } catch (e) {
      console.error(`  [${city}] rent FAILED: ${(e as Error).message}`);
    }
    try {
      const { scrapeTransportSamples, transportPricePremium, saveTransportMetrics } = await import(
        "../src/lib/locality/transport"
      );
      const samples = await scrapeTransportSamples(city, 80);
      const model = transportPricePremium(samples);
      if (samples.length > 0) {
        await saveTransportMetrics(city, model.premiumPct, samples.length);
      }
      console.log(`  [${city}] transport: ${samples.length} vzorku, premie ${model.premiumPct ?? "-"}%`);
    } catch (e) {
      console.error(`  [${city}] transport FAILED: ${(e as Error).message}`);
    }
  }

  const rows = await db
    .select({ id: properties.id, city: propertyAnalysis.locationCity })
    .from(propertyAnalysis)
    .innerJoin(properties, eq(propertyAnalysis.propertyId, properties.id))
    .where(and(eq(properties.isActive, 1)));
  console.log(`Properties: ${rows.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Locality refresh failed:", e);
  process.exit(1);
});
