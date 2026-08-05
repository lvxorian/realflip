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
    const existing = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'calculator_presets' AND column_name = 'mode'`;
    if (existing.length > 0) {
      console.log("[Neon] sloupec mode už existuje — přeskočeno");
    } else {
      await sql`ALTER TABLE calculator_presets ADD COLUMN mode text NOT NULL DEFAULT 'flip'`;
      console.log("[Neon] přidán sloupec mode do calculator_presets");
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
      const cols = db.prepare(`PRAGMA table_info(calculator_presets)`).all() as { name: string }[];
      if (cols.some((c) => c.name === "mode")) {
        console.log("[SQLite] sloupec mode už existuje — přeskočeno");
      } else {
        db.exec(`ALTER TABLE calculator_presets ADD COLUMN mode text NOT NULL DEFAULT 'flip'`);
        console.log("[SQLite] přidán sloupec mode do calculator_presets");
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
