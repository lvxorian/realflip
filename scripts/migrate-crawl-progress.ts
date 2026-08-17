import "./_env";
import { neon } from "@neondatabase/serverless";

/**
 * Aplikuje crawl_progress (progress hromadného hledání) na Neon.
 * Idempotentní — bezpečné opakování. Musí jít přes přímé (non-pooler)
 * připojení, DDL se přes -pooler transaction mode tiše neaplikuje.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[Neon] DATABASE_URL nenalezen — přeskočeno");
    process.exit(0);
  }
  const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
  const sql = neon(directUrl);

  const existing = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'crawl_progress'
  `;
  if (existing.length > 0) {
    console.log("[Neon] crawl_progress už existuje — přeskočeno");
    process.exit(0);
  }

  await sql.unsafe(`
    CREATE TABLE "crawl_progress" (
      "id" text PRIMARY KEY NOT NULL,
      "portal" text NOT NULL,
      "city" text DEFAULT '' NOT NULL,
      "step" integer DEFAULT 0 NOT NULL,
      "updated_at" bigint NOT NULL
    )
  `);
  console.log("[Neon] crawl_progress vytvořena");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});