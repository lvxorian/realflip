import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Odstraní nepoužívaný sloupec investors.portal_password_hash (přihlášení
// investorů se odvozuje z jména — viz src/lib/investor-credentials.ts).
async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);

    const cols = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investors' AND column_name = 'portal_password_hash'
    `;
    if (cols.length > 0) {
      await sql`ALTER TABLE investors DROP COLUMN portal_password_hash`;
      console.log("[Neon] investors.portal_password_hash odstraněn");
    } else {
      console.log("[Neon] investors.portal_password_hash už neexistuje — přeskočeno");
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
      if (cols.some((c) => c.name === "portal_password_hash")) {
        db.exec(`ALTER TABLE investors DROP COLUMN portal_password_hash;`);
        console.log("[SQLite] investors.portal_password_hash odstraněn");
      } else {
        console.log("[SQLite] investors.portal_password_hash už neexistuje — přeskočeno");
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
