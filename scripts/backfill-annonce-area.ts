import "./_env";
import { neon } from "@neondatabase/serverless";

/**
 * Backfill: annonce.cz adapter neparsoval plochu (bug v selektoru `td:first-child`
 * opraven v adapters/annonce.ts — th je před td, td:first-child nikdy nematchl).
 * Tento skript doplní plochu z titulku (stejný regex jako extractArea) a z ní
 * spočítá price_per_sqm pro existující záznamy. Idempotentní (jen NULL area).
 */
const AREA_RE = /(\d+[,.]?\d*)\s*m[²2]/i;

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const rows = await sql`SELECT id, title, url, price FROM properties WHERE portal_name = 'annonce' AND area IS NULL`;

  // URL slugy annonce.cz nesou plochu: /inzerat/prodej-byt-2-1-62-m2-85680651-….html
  const URL_AREA_RE = /(\d+(?:[.,]\d+)?)-?m2/i;

  let updated = 0;
  let fromUrl = 0;
  let noArea = 0;
  // Artefakt starého scraperu: „95 m&sup2;" se uložilo jako „95 m and sup2".
  const SUP2_RE = /(\d+(?:[.,]\d+)?)\s*m\s*(?:and\s*)?sup2/i;

  for (const r of rows) {
    let m = r.title?.match(AREA_RE);
    if (!m) m = r.title?.match(SUP2_RE) ?? null;
    if (!m && r.url) m = r.url.match(URL_AREA_RE);
    if (m && m[0].includes("sup2")) fromUrl++;
    if (!m) {
      noArea++;
      continue;
    }
    const area = parseFloat(m[1].replace(",", "."));
    if (!(area > 0)) {
      noArea++;
      continue;
    }
    const pps = r.price > 0 ? Math.round(r.price / area) : null;
    await sql`
      UPDATE properties
      SET area = ${area}, price_per_sqm = ${pps}
      WHERE id = ${r.id}
    `;
    updated++;
  }

  console.log(`annonce bez plochy: ${rows.length} | doplněno: ${updated} (z toho z URL: ${fromUrl}) | stále bez: ${noArea}`);

  const after = await sql`SELECT COUNT(*)::int AS total, SUM(CASE WHEN price_per_sqm IS NULL THEN 1 ELSE 0 END)::int AS null_pps FROM properties WHERE portal_name = 'annonce'`;
  console.log("annonce po backfillu:", JSON.stringify(after[0]));
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
