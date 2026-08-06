import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Přidá sloupce pro sledování aktivity investorů na portálu:
// investors.last_active_at (poslední aktivita) + investors.login_count
// (počet přihlášení). Viz src/lib/investor-activity.ts.
async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);

    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'investors' AND column_name IN ('last_active_at', 'login_count')
    `;
    const names = new Set(cols.map((c: { column_name: string }) => c.column_name));
    if (!names.has("last_active_at")) {
      await sql`ALTER TABLE investors ADD COLUMN last_active_at bigint`;
      console.log("[Neon] investors.last_active_at přidán");
    } else {
      console.log("[Neon] investors.last_active_at už existuje — přeskočeno");
    }
    if (!names.has("login_count")) {
      await sql`ALTER TABLE investors ADD COLUMN login_count integer NOT NULL DEFAULT 0`;
      console.log("[Neon] investors.login_count přidán");
    } else {
      console.log("[Neon] investors.login_count už existuje — přeskočeno");
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
      const cols = db.prepare(`PRAGMA table_info(investors)`).all() as { name: string }[];
      if (!cols.some((c) => c.name === "last_active_at")) {
        db.exec(`ALTER TABLE investors ADD COLUMN last_active_at integer;`);
        console.log("[SQLite] investors.last_active_at přidán");
      } else {
        console.log("[SQLite] investors.last_active_at už existuje — přeskočeno");
      }
      if (!cols.some((c) => c.name === "login_count")) {
        db.exec(`ALTER TABLE investors ADD COLUMN login_count integer NOT NULL DEFAULT 0;`);
        console.log("[SQLite] investors.login_count přidán");
      } else {
        console.log("[SQLite] investors.login_count už existuje — přeskočeno");
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