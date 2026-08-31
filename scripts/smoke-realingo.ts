import { saveRealingoAccountConfig, syncRealingo } from "../src/lib/realingo/sync";
import { getRealingoClient } from "../src/lib/realingo/graphql-client";
import { getRealingoUser } from "../src/lib/realingo/offers";
import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  const email = process.env.REALINGO_EMAIL!;
  const password = process.env.REALINGO_PASSWORD!;
  if (!email || !password) {
    console.error("REALINGO_EMAIL/REALINGO_PASSWORD required");
    process.exit(1);
  }

  console.log("=== 1. Login / user ===");
  const user = await getRealingoUser();
  console.log("user:", user);

  console.log("\n=== 2. Save config (enabled) ===");
  await saveRealingoAccountConfig({
    enabled: true,
    address: "Praha",
    purpose: "SELL",
    property: "FLAT",
    buildingStatuses: ["BEFORE_RECONSTRUCTION"],
    sort: "NEWEST",
    first: 20,
  });
  console.log("config saved");

  console.log("\n=== 3. Sync ===");
  const result = await syncRealingo();
  console.log("result:", result);

  console.log("\n=== 4. Verify persisted properties ===");
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.portalName, "realingo"))
    .orderBy(desc(properties.firstSeen))
    .limit(5);
  for (const r of rows) {
    console.log(
      `- ${r.title} | price=${r.price} | realingoId=${r.realingoId} | rating=${r.priceRating} (tier ${r.priceTier}) | early=${r.isEarlyOffer}`
    );
  }
  console.log("total realingo properties:", rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
