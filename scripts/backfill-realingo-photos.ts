import "./_env";
import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchRealingoPagePhotos } from "../src/lib/realingo/page-photos";

// Doplní fotky existujícím realingo řádkům, které je mají prázdné.
// Zdroj: veřejná HTML stránka nabídky (bez GraphQL authu). Idempotentní —
// příští běh nechá already-populated řádky na pokoji.
async function main() {
  const rows = await db
    .select({ id: properties.id, url: properties.url })
    .from(properties)
    .where(
      sql`${properties.portalName} = 'realingo' AND ("image_urls" IS NULL OR "image_urls" = '[]' OR "image_urls" = '')`
    );
  console.log(`realingo bez fotek: ${rows.length}`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const imgs = await fetchRealingoPagePhotos(r.url);
      if (imgs.length > 0) {
        await db
          .update(properties)
          .set({ imageUrls: JSON.stringify(imgs) })
          .where(eq(properties.id, r.id));
        ok++;
        console.log(`[${i + 1}/${rows.length}] +${imgs.length} fotek ${r.url}`);
      } else {
        fail++;
        console.log(`[${i + 1}/${rows.length}] BEZ FOTEK v HTML ${r.url}`);
      }
    } catch (e) {
      fail++;
      console.log(`[${i + 1}/${rows.length}] SELHALO ${r.url}: ${(e as Error).message}`);
    }
    await new Promise((res) => setTimeout(res, 300)); // nechat portál na pokoji
  }
  console.log(`hotovo: ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
