import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);
    for (const column of ["cash_flow_monthly", "calc_snapshot"]) {
      const existing = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_analysis' AND column_name = ${column}`;
      if (existing.length > 0) {
        console.log(`[Neon] sloupec ${column} už existuje — přeskočeno`);
      } else {
        const type = column === "calc_snapshot" ? "text" : "integer";
        await sql.unsafe(`ALTER TABLE property_analysis ADD COLUMN "${column}" ${type}`);
        console.log(`[Neon] přidán sloupec ${column} do property_analysis`);
      }
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
      const existingNames = new Set(cols.map((c) => c.name));
      for (const column of ["cash_flow_monthly", "calc_snapshot"]) {
        if (existingNames.has(column)) {
          console.log(`[SQLite] sloupec ${column} už existuje — přeskočeno`);
        } else {
          const type = column === "calc_snapshot" ? "text" : "integer";
          db.exec(`ALTER TABLE property_analysis ADD COLUMN ${column} ${type}`);
          console.log(`[SQLite] přidán sloupec ${column} do property_analysis`);
        }
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