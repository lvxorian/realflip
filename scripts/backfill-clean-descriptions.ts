/**
 * Backfill: vyčistí HTML tagy z uložených popisů nemovitostí.
 *
 * Proč: sreality API vrací popis jako HTML (`<br />`, `<p>`, entity…), a starší
 * záznamy ho mají uložený syrový. Tento skript projde popisy obsahující HTML
 * tagy a převede je na čistý text (`<br>` → nový řádek, tagy a entity pryč).
 *
 * Spuštění: npx tsx scripts/backfill-clean-descriptions.ts
 */
import "./_env";
import { neon } from "@neondatabase/serverless";
import { cleanHtmlToText } from "../src/lib/scraping/types";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Popisy obsahující skutečný HTML tag (<br, <p, </p …) — vynecháme legitimní "< 10 min".
  const rows = await sql`
    SELECT id, description
    FROM properties
    WHERE description ~ '<[a-zA-Z/]'
  `;
  console.log(`Nalezeno ${rows.length} popisů s HTML tagy`);

  let fixed = 0;
  for (const row of rows) {
    const cleaned = cleanHtmlToText(String(row.description));
    if (cleaned === null || cleaned === String(row.description)) continue;

    await sql`
      UPDATE properties
      SET description = ${cleaned}
      WHERE id = ${String(row.id)}
    `;
    fixed++;
    console.log(`  OK  ${String(row.id).slice(0, 8)}: ${String(row.description).length} → ${cleaned.length} znaků`);
  }

  console.log(`\nHotovo: ${fixed} popisů vyčištěno`);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
