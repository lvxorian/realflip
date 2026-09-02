import "./_env";
import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { normalizeRatingLabel } from "../src/lib/realingo/rating";
import { safeJsonParse } from "../src/lib/utils";

// Jednorázový přepočet uloženého price_rating na slovník webu Realinga
// (tier 1 = „Vynikající cena", API label mělo staré „Velmi dobrá cena").
// Idempotentní — řádky ve správné slovní zásobě přeskočí.
async function main() {
  const rows = await db
    .select({
      id: properties.id,
      url: properties.url,
      rating: properties.priceRating,
      json: properties.priceRatingJson,
    })
    .from(properties)
    .where(eq(properties.portalName, "realingo"));

  let updated = 0;
  for (const r of rows) {
    const s = safeJsonParse<{ tier?: string | number | null; label?: string | null }>(
      typeof r.json === "string" ? r.json : (r.json as never),
      {}
    );
    const want = normalizeRatingLabel(r.rating, s?.tier ?? null);
    if (want && want !== r.rating) {
      await db.update(properties).set({ priceRating: want }).where(eq(properties.id, r.id));
      updated++;
      console.log(`${r.rating} -> ${want} (${r.url.split("/").pop()})`);
    }
  }
  console.log(`zkontrolováno ${rows.length}, přepsáno ${updated}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
