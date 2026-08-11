/**
 * Backfill fotek pro realitymix a remax.
 *
 * Proč: realitymix parser dříve hledal `.gallery__items` (neexistuje) a bral jen
 * ~3 fotky, i když stránka jich má ~29. Remax adapter bral jen 1 náhled z kartičky,
 * i když detailní stránka má celou galerii (a[data-fancybox="images"] → href).
 *
 * Tento skript přenačte detailní stránky existujících nemovitostí a doplní plnou
 * galerii (jen pokud nových fotek bude VÍC než je v DB).
 *
 * Spuštění: npx tsx scripts/backfill-portal-images.ts [portal] [limit]
 *   portal: realitymix | remax | all (default all)
 *   limit:  max počtu nemovitostí k obnově (default 20, 0 = všechny)
 */
import "./_env";
import * as cheerio from "cheerio";
import { neon } from "@neondatabase/serverless";
import { extractRealityMixImages } from "../src/lib/scraping/realitymix-parser";
import { extractRemaxGalleryImages } from "../src/lib/scraping/adapters/remax";

const sql = neon(process.env.DATABASE_URL!);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "cs,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const portalArg = (process.argv[2] ?? "all").toLowerCase();
  const limit = parseInt(process.argv[3] ?? "20", 10) || 0;

  const portals = portalArg === "all" ? ["realitymix", "remax"] : [portalArg];
  let totalUpdated = 0;
  let totalChecked = 0;

  for (const portal of portals) {
    // Cílíme na nemovitosti s chybějícími fotkami (parser jich dřív bral jen pár) —
    // ty, co už mají plnou galerii (sloučenou z dvojčete na jiném portálu), necháme být.
    const rows = await sql`
      SELECT id, url, image_urls::json AS imgs
      FROM properties
      WHERE portal_name = ${portal} AND is_active = 1
        AND json_array_length(image_urls::json) < 8
      ORDER BY last_seen DESC
      ${limit > 0 ? sql`LIMIT ${limit}` : sql``}
    `;

    console.log(`\n=== ${portal}: ${rows.length} nemovitostí ===`);

    for (const row of rows) {
      totalChecked++;
      const oldImgs: string[] = Array.isArray(row.imgs) ? row.imgs : [];
      try {
        const html = await fetchHtml(String(row.url));
        const newImgs =
          portal === "realitymix"
            ? extractRealityMixImages(cheerio.load(html))
            : extractRemaxGalleryImages(html);

        if (newImgs.length > oldImgs.length) {
          await sql`
            UPDATE properties
            SET image_urls = ${JSON.stringify(newImgs)}
            WHERE id = ${String(row.id)}
          `;
          totalUpdated++;
          console.log(
            `  OK  ${String(row.id).slice(0, 8)}: ${oldImgs.length} → ${newImgs.length} fotek`
          );
        } else if (newImgs.length === 0) {
          console.log(`  --  ${String(row.id).slice(0, 8)}: žádné fotky (stránka bez galerie?)`);
        }
      } catch (e) {
        console.log(
          `  ERR ${String(row.id).slice(0, 8)}: ${e instanceof Error ? e.message : e}`
        );
      }
      // Ohleduplnost k portálu (rate limit jako ve scraperu)
      await sleep(portal === "remax" ? 3000 : 2000);
    }
  }

  console.log(
    `\nHotovo: ${totalUpdated} nemovitostí doplněno (z ${totalChecked} kontrolovaných)`
  );
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
