import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Přidá sloupec properties.removed_at — timestamp, kdy byl inzerát potvrzen
// jako odstraněný (po grace period bez nálezu). Viz relisting/sweep logika
// v src/lib/scraping/orchestrator.ts.
async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);

    const cols = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'removed_at'
    `;
    if (cols.length === 0) {
      await sql`ALTER TABLE properties ADD COLUMN removed_at integer`;
      console.log("[Neon] properties.removed_at přidán");
    } else {
      console.log("[Neon] properties.removed_at už existuje — přeskočeno");
    }
  } else {
    console.log("[Neon] DATABASE_URL nenalezen — Neon přeskočen");
  }

  const dbPath = path.join(process.cwd(), "data.db");
  if (process.env.DATABASE_URL) {
    console.log(`[SQLite] ${dbPath} přeskočen (cloud režim)`);
  } else if (process.env.NODE_ENV !== "production") {
    if (!fs.existsSync(dbPath)) {
      console.log(`[SQLite] ${dbPath} neexistuje — přeskočeno`);
    } else {
      const db = new Database(dbPath);
      const cols = db.prepare(`PRAGMA table_info(properties)`).all() as { name: string }[];
      if (!cols.some((c) => c.name === "removed_at")) {
        db.exec(`ALTER TABLE properties ADD COLUMN removed_at integer;`);
        console.log("[SQLite] properties.removed_at přidán");
      } else {
        console.log("[SQLite] properties.removed_at už existuje — přeskočeno");
      }
      db.close();
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});