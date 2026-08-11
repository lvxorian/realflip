import "./_env";
import { neon } from "@neondatabase/serverless";

/**
 * Backfill: bazos.cz adapter ukládal price_per_sqm = null natvrdo (bug opraven
 * v adapters/bazos.ts — teď se počítá z ceny/plochy). Tento skript doplní
 * chybějící Kč/m² pro existující záznamy, aby je UI ukázalo hned, bez čekání
 * na příští crawl. Idempotentní — UPDATE zasáhne jen řádky s NULL.
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const before = await sql`SELECT COUNT(*)::int AS c FROM properties WHERE portal_name = 'bazos' AND price_per_sqm IS NULL AND area IS NOT NULL AND area > 0`;
  console.log(`bazos bez price_per_sqm (s plochou): ${before[0]?.c}`);

  const res = await sql`
    UPDATE properties
    SET price_per_sqm = ROUND(price::numeric / area)
    WHERE portal_name = 'bazos'
      AND price_per_sqm IS NULL
      AND area IS NOT NULL AND area > 0
      AND price IS NOT NULL AND price > 0
    RETURNING id, title, price, area, price_per_sqm
  `;
  console.log(`Aktualizováno: ${res.length}`);
  for (const r of res.slice(0, 10)) {
    console.log(`  ${r.title?.slice(0, 50)} | ${r.price} Kč / ${r.area} m² = ${r.price_per_sqm} Kč/m²`);
  }

  const after = await sql`SELECT COUNT(*)::int AS c FROM properties WHERE portal_name = 'bazos' AND price_per_sqm IS NULL AND area IS NOT NULL AND area > 0`;
  console.log(`zbývá bez price_per_sqm (s plochou): ${after[0]?.c}`);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
