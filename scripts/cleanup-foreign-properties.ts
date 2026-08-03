import { db } from "../src/db";
import { properties, searchProperties } from "../src/db/schema";
import { inArray } from "drizzle-orm";
import { isCzechListing } from "../src/lib/scraping/filters";
import { ts } from "../src/lib/utils";

/**
 * Vyčistí zahraniční nemovitosti, které prošly crawlem (např. Berlín z
 * bezrealitky) a nejsou v České republice.
 * Usage:
 *   npx tsx scripts/cleanup-foreign-properties.ts           # deaktivuje (default)
 *   npx tsx scripts/cleanup-foreign-properties.ts --dry-run # jen výpis
 *   npx tsx scripts/cleanup-foreign-properties.ts --delete  # tvrdé smazání
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const hardDelete = process.argv.includes("--delete");
  if (dryRun) console.log("=== DRY RUN — bez zápisu ===\n");

  const rows = await db
    .select({
      id: properties.id,
      title: properties.title,
      address: properties.address,
      lat: properties.lat,
      lng: properties.lng,
      isActive: properties.isActive,
      portalName: properties.portalName,
      url: properties.url,
    })
    .from(properties);

  const foreign = rows.filter((p) => !isCzechListing(p));
  const activeForeign = foreign.filter((p) => p.isActive === 1);

  console.log(`Celkem properties: ${rows.length}`);
  console.log(`Zahraniční (ne-CZ): ${foreign.length} (aktivních: ${activeForeign.length})\n`);

  if (dryRun) {
    for (const p of activeForeign) {
      console.log(`  ${p.id.slice(0, 12)} | ${p.portalName} | ${(p.address ?? p.title).slice(0, 60)}`);
    }
    console.log(`\n${activeForeign.length} zahraničních by bylo ${hardDelete ? "smazáno" : "deaktivováno"}.`);
    process.exit(0);
  }

  const ids = foreign.map((p) => p.id);
  if (ids.length === 0) {
    console.log("Nic k vyčištění.");
    process.exit(0);
  }

  if (hardDelete) {
    await db.delete(searchProperties).where(inArray(searchProperties.propertyId, ids));
    await db.delete(properties).where(inArray(properties.id, ids));
    console.log(`Smazáno ${ids.length} zahraničních nemovitostí (+ propojení).`);
  } else {
    await db
      .update(properties)
      .set({ isActive: 0, lastSeen: ts() })
      .where(inArray(properties.id, ids));
    console.log(`Deaktivováno ${ids.length} zahraničních nemovitostí.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
