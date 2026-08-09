import "./_env";
import { Pool } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const LEADS_COLUMNS: { name: string; type: string }[] = [
  { name: "position", type: "integer" },
  { name: "stage_entered_at", type: "bigint" },
  { name: "lost_reason", type: "text" },
  { name: "next_step", type: "text" },
  { name: "next_step_due_at", type: "bigint" },
];

const PG_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS "lead_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_events_lead_id_idx" ON "lead_events" ("lead_id");
`;

const SQLITE_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS "lead_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
	"type" text NOT NULL,
	"payload" text DEFAULT '{}',
	"created_at" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_events_lead_id_idx" ON "lead_events" ("lead_id");
`;

async function migrateNeon() {
  const directUrl = process.env.DATABASE_URL!.replace("-pooler", "");
  const pool = new Pool({ connectionString: directUrl });
  try {
    const cols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'"
    );
    const have = new Set(cols.rows.map((r: { column_name: string }) => r.column_name));
    for (const col of LEADS_COLUMNS) {
      if (have.has(col.name)) {
        console.log(`[Neon] leads.${col.name} už existuje — přeskočeno`);
        continue;
      }
      await pool.query(
        `ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`
      );
      console.log(`[Neon] přidán sloupec leads.${col.name} (${col.type})`);
    }

    const exists = await pool.query("SELECT to_regclass('public.lead_events') AS name");
    if (exists.rows[0]?.name) {
      console.log("[Neon] tabulka lead_events už existuje — přeskočeno");
    } else {
      await pool.query(PG_EVENTS_DDL);
      const check = await pool.query("SELECT to_regclass('public.lead_events') AS name");
      if (check.rows[0]?.name) {
        console.log("[Neon] vytvořena tabulka lead_events (ověřeno)");
      } else {
        throw new Error("CREATE TABLE proběhl, ale tabulka se neobjevila");
      }
    }
  } finally {
    await pool.end();
  }
}

function migrateSqlite(dbPath: string) {
  const db = new Database(dbPath);
  const cols = db.prepare(`PRAGMA table_info(leads)`).all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  for (const col of LEADS_COLUMNS) {
    if (have.has(col.name)) {
      console.log(`[SQLite] leads.${col.name} už existuje — přeskočeno`);
      continue;
    }
    db.exec(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`);
    console.log(`[SQLite] přidán sloupec leads.${col.name} (${col.type})`);
  }
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='lead_events'`)
    .all() as { name: string }[];
  if (tables.length > 0) {
    console.log("[SQLite] tabulka lead_events už existuje — přeskočeno");
  } else {
    db.exec(SQLITE_EVENTS_DDL);
    const check = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='lead_events'`)
      .all() as { name: string }[];
    if (check.length > 0) {
      console.log("[SQLite] vytvořena tabulka lead_events (ověřeno)");
    } else {
      throw new Error("CREATE TABLE proběhl, ale tabulka se neobjevila");
    }
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