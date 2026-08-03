import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { toFullSizeImageUrl } from "../src/lib/scraping/types";

/**
 * Oprava rozmazaných fotek z annonce.cz — transformuje uložené malé
 * náhledy (.../{id}_{N}.jpg) na full-size (.../{id}.jpg) a dedupuje.
 * Usage: npx tsx scripts/fix-annonce-images.ts [--dry-run]
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("=== DRY RUN — bez zápisu ===\n");

  const rows = await db
    .select({ id: properties.id, title: properties.title, imageUrls: properties.imageUrls })
    .from(properties)
    .where(eq(properties.portalName, "annonce"));
  console.log(`Annonce properties: ${rows.length}\n`);

  let changed = 0;
  let skipped = 0;
  let fixed = 0;
  let errors = 0;

  for (const p of rows) {
    let urls: string[] = [];
    try {
      urls = p.imageUrls ? JSON.parse(p.imageUrls) : [];
    } catch {
      errors++;
      console.log(`  SKIP ${p.id.slice(0, 12)} — špatný JSON`);
      continue;
    }

    const before = urls;
    urls = [...new Set(urls.map((u) => toFullSizeImageUrl(u, "annonce")).filter(Boolean))];

    if (before.length === urls.length && before.every((u, i) => u === urls[i])) {
      skipped++;
      continue;
    }

    changed++;
    if (before.length !== urls.length) fixed += before.length - urls.length;

    if (dryRun) {
      console.log(`  ${p.id.slice(0, 12)} | ${p.title.slice(0, 40)} | ${before.length} → ${urls.length} fotek`);
      continue;
    }

    try {
      await db.update(properties).set({ imageUrls: JSON.stringify(urls) }).where(eq(properties.id, p.id));
      console.log(`  OK ${p.id.slice(0, 12)} | ${before.length} → ${urls.length}`);
    } catch (err) {
      errors++;
      console.error(`  FAILED ${p.id.slice(0, 12)}: ${err}`);
    }
  }

  console.log(`\nChanged: ${changed}, skipped: ${skipped}, removed thumbnails: ${fixed}, errors: ${errors}`);
  if (dryRun) console.log("DRY RUN dokončen — pro zápis spusťte bez --dry-run.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
