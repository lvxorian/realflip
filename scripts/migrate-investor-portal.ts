import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Investor portal: leads.portal_* + investors.portal_*
// DDL na Neonu přes direct (non-pooler) připojení — pooler v transaction mode DDL tiše neaplikuje.
async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);

    const leaksPortal = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'portal_visible'
    `;
    if (leaksPortal.length === 0) {
      await sql`
        ALTER TABLE leads
        ADD COLUMN portal_visible integer DEFAULT 1,
        ADD COLUMN portal_status text DEFAULT 'available',
        ADD COLUMN portal_reserved_investor_id text
      `;
      await sql`
        ALTER TABLE leads
        ADD CONSTRAINT leads_portal_reserved_investor_id_investors_id_fk
        FOREIGN KEY (portal_reserved_investor_id) REFERENCES investors(id) ON DELETE set null
      `;
      console.log("[Neon] leads.portal_* přidány");
    } else {
      console.log("[Neon] leads.portal_* už existují — přeskočeno");
    }

    const investorColumns = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investors' AND column_name IN ('portal_enabled', 'portal_password_hash')
    `;
    if (investorColumns.length === 0) {
      await sql`
        ALTER TABLE investors
        ADD COLUMN portal_enabled integer DEFAULT 0,
        ADD COLUMN portal_password_hash text
      `;
      console.log("[Neon] investors.portal_* přidány");
    } else {
      console.log("[Neon] investors.portal_* už existují — přeskočeno");
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
      const leadsCols = (db.prepare(`PRAGMA table_info(leads)`).all() as { name: string }[]).map((c) => c.name);
      if (leadsCols.includes("portal_visible")) {
        console.log("[SQLite] leads.portal_* už existují — přeskočeno");
      } else {
        db.exec(`
          ALTER TABLE leads ADD COLUMN portal_visible integer DEFAULT 1;
          ALTER TABLE leads ADD COLUMN portal_status text DEFAULT 'available';
          ALTER TABLE leads ADD COLUMN portal_reserved_investor_id text REFERENCES investors(id) ON DELETE set null;
        `);
        console.log("[SQLite] leads.portal_* přidány");
      }
      const investorCols = db.prepare(`PRAGMA table_info(investors)`).all() as { name: string }[];
      if (investorCols.some((c) => c.name === "portal_enabled")) {
        console.log("[SQLite] investors.portal_* už existují — přeskočeno");
      } else {
        db.exec(`
          ALTER TABLE investors ADD COLUMN portal_enabled integer DEFAULT 0;
          ALTER TABLE investors ADD COLUMN portal_password_hash text;
        `);
        console.log("[SQLite] investors.portal_* přidány");
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