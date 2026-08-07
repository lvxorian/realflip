import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

async function main() {
  if (process.env.DATABASE_URL) {
    // Pooler (-pooler) v transaction mode DDL tiše neaplikuje — DDL musí jít
    // přes přímé (non-pooler) připojení.
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);
    const existing = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_analysis' AND column_name = 'calc_mode'`;
    if (existing.length > 0) {
      console.log("[Neon] sloupec calc_mode už existuje — přeskočeno");
    } else {
      await sql`ALTER TABLE property_analysis ADD COLUMN calc_mode text DEFAULT 'flip'`;
      console.log("[Neon] přidán sloupec calc_mode do property_analysis");
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
      const cols = db.prepare(`PRAGMA table_info(property_analysis)`).all() as { name: string }[];
      if (cols.some((c) => c.name === "calc_mode")) {
        console.log("[SQLite] sloupec calc_mode už existuje — přeskočeno");
      } else {
        db.exec(`ALTER TABLE property_analysis ADD COLUMN calc_mode text DEFAULT 'flip'`);
        console.log("[SQLite] přidán sloupec calc_mode do property_analysis");
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
