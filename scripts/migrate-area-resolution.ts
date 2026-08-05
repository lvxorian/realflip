import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";

const PG_COLUMNS = ["floor_area", "usable_area", "accessory_area", "area_flag"];
const SQLITE_COLUMNS = ["floor_area", "usable_area", "accessory_area", "area_flag"];

async function main() {
  if (process.env.DATABASE_URL) {
    // Pooler (-pooler) v transaction mode DDL tiše neaplikuje — ALTER musí jít
    // přes přímé (non-pooler) připojení. Host má tvar "...pooler.c-4.eu-central-1..." —
    // odstraněním "-pooler" získáme direct připojení (zůstane ".c-4.").
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);
    const existing = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'properties'`;
    const have = new Set(existing.map((r: any) => r.column_name));
    for (const col of PG_COLUMNS) {
      if (have.has(col)) {
        console.log(`[Neon] ${col} už existuje — přeskočeno`);
        continue;
      }
      const type = col === "area_flag" ? "text" : "real";
      await sql`ALTER TABLE properties ADD COLUMN ${sql.unsafe(col)} ${sql.unsafe(type)}`;
      console.log(`[Neon] přidán sloupec ${col} (${type})`);
    }
  } else {
    console.log("[Neon] DATABASE_URL nenalezen — Neon přeskočen");
  }

  const dbPath = path.join(process.cwd(), "data.db");
  if (process.env.DATABASE_URL) {
    console.log(`[SQLite] ${dbPath} přeskočen (cloud režim)`);
  } else if (process.env.NODE_ENV !== "production") {
    if (!require("fs").existsSync(dbPath)) {
      console.log(`[SQLite] ${dbPath} neexistuje — přeskočeno`);
    } else {
      const db = new Database(dbPath);
      const cols = db.prepare(`PRAGMA table_info(properties)`).all() as { name: string }[];
      const have = new Set(cols.map((c) => c.name));
      for (const col of SQLITE_COLUMNS) {
        if (have.has(col)) {
          console.log(`[SQLite] ${col} už existuje — přeskočeno`);
          continue;
        }
        const type = col === "area_flag" ? "text" : "real";
        db.exec(`ALTER TABLE properties ADD COLUMN ${col} ${type}`);
        console.log(`[SQLite] přidán sloupec ${col} (${type})`);
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
