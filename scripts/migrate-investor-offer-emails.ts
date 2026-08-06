import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Vytvoří tabulku investor_offer_emails pro dedup automatických e-mailů
// s nabídkami investorům (UNIQUE investor_id + lead_id). Viz
// src/lib/email/notify-offers.ts.
async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);

    const tables = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investor_offer_emails'
    `;
    if (tables.length === 0) {
      await sql`
        CREATE TABLE investor_offer_emails (
          id text PRIMARY KEY NOT NULL,
          investor_id text NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
          lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
          sent_at bigint NOT NULL
        )
      `;
      await sql`CREATE UNIQUE INDEX investor_offer_emails_unique ON investor_offer_emails (investor_id, lead_id)`;
      console.log("[Neon] investor_offer_emails vytvořena");
    } else {
      console.log("[Neon] investor_offer_emails už existuje — přeskočeno");
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
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'investor_offer_emails'`).all();
      if (tables.length === 0) {
        db.exec(`
          CREATE TABLE investor_offer_emails (
            id text PRIMARY KEY NOT NULL,
            investor_id text NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
            lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            sent_at integer NOT NULL
          );
          CREATE UNIQUE INDEX investor_offer_emails_unique ON investor_offer_emails (investor_id, lead_id);
        `);
        console.log("[SQLite] investor_offer_emails vytvořena");
      } else {
        console.log("[SQLite] investor_offer_emails už existuje — přeskočeno");
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