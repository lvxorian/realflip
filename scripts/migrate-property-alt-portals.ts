import "./_env";
import { Pool } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Sloupec alt_portals: sekundární portály stejné nemovitosti [{ portalName, url }].
// SQLite: text default '[]' · Neon: jsonb default '[]'

async function migrateNeon() {
  const directUrl = process.env.DATABASE_URL!.replace("-pooler", "");
  const pool = new Pool({ connectionString: directUrl });
  try {
    const cols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'properties'"
    );
    const have = new Set(cols.rows.map((r: { column_name: string }) => r.column_name));
    if (have.has("alt_portals")) {
      console.log("[Neon] properties.alt_portals už existuje — přeskočeno");
    } else {
      await pool.query(`ALTER TABLE properties ADD COLUMN alt_portals jsonb DEFAULT '[]'::jsonb NOT NULL`);
      console.log("[Neon] přidán sloupec properties.alt_portals (jsonb)");
    }
  } finally {
    await pool.end();
  }
}

function migrateSqlite(dbPath: string) {
  const db = new Database(dbPath);
  const cols = db.prepare(`PRAGMA table_info(properties)`).all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  if (have.has("alt_portals")) {
    console.log("[SQLite] properties.alt_portals už existuje — přeskočeno");
  } else {
    db.exec(`ALTER TABLE properties ADD COLUMN alt_portals text DEFAULT '[]'`);
    console.log("[SQLite] přidán sloupec properties.alt_portals (text)");
  }
  db.close();
}

async function main() {
  if (process.env.DATABASE_URL) {
    await migrateNeon();
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
      migrateSqlite(dbPath);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});