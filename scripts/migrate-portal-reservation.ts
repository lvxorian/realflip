import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Portal rezervace: leads.portal_reserved_* + investors.preferred_model
// (portal_waitlist byla zrušena — skript ji idempotentně dropuje)
// DDL na Neonu přes direct (non-pooler) připojení — pooler v transaction mode DDL tiše neaplikuje.
async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);

    const leadCols = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'portal_reserved_model'
    `;
    if (leadCols.length === 0) {
      await sql`
        ALTER TABLE leads
        ADD COLUMN portal_reserved_model text,
        ADD COLUMN portal_reserved_at bigint,
        ADD COLUMN portal_expires_at bigint
      `;
      console.log("[Neon] leads.portal_reserved_* přidány");
    } else {
      console.log("[Neon] leads.portal_reserved_* už existují — přeskočeno");
    }

    const invCols = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investors' AND column_name = 'preferred_model'
    `;
    if (invCols.length === 0) {
      await sql`ALTER TABLE investors ADD COLUMN preferred_model text`;
      console.log("[Neon] investors.preferred_model přidán");
    } else {
      console.log("[Neon] investors.preferred_model už existuje — přeskočeno");
    }

    const waitlistExists = await sql`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_waitlist'
    `;
    if (waitlistExists.length > 0) {
      await sql`DROP TABLE portal_waitlist`;
      console.log("[Neon] portal_waitlist zrušena (pořadník byl odstraněn)");
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
      const leadCols = (db.prepare(`PRAGMA table_info(leads)`).all() as { name: string }[]).map((c) => c.name);
      if (leadCols.includes("portal_reserved_model")) {
        console.log("[SQLite] leads.portal_reserved_* už existují — přeskočeno");
      } else {
        db.exec(`
          ALTER TABLE leads ADD COLUMN portal_reserved_model text;
          ALTER TABLE leads ADD COLUMN portal_reserved_at integer;
          ALTER TABLE leads ADD COLUMN portal_expires_at integer;
        `);
        console.log("[SQLite] leads.portal_reserved_* přidány");
      }
      const invCols = (db.prepare(`PRAGMA table_info(investors)`).all() as { name: string }[]).map((c) => c.name);
      if (invCols.includes("preferred_model")) {
        console.log("[SQLite] investors.preferred_model už existuje — přeskočeno");
      } else {
        db.exec(`ALTER TABLE investors ADD COLUMN preferred_model text;`);
        console.log("[SQLite] investors.preferred_model přidán");
      }
      const waitlistExists = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='portal_waitlist'`).all() as { name: string }[]);
      if (waitlistExists.length > 0) {
        db.exec(`DROP TABLE portal_waitlist;`);
        console.log("[SQLite] portal_waitlist zrušena (pořadník byl odstraněn)");
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