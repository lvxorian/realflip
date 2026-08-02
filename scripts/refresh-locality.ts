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
  console.log(`\nRefreshed metrics: ${ok} city-metrics, failed sources: ${failed}`);

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
