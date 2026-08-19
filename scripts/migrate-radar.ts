import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const PG_TABLES: [name: string, ddl: string][] = [
  [
    "radar_series",
    `CREATE TABLE IF NOT EXISTS radar_series (
      indicator text NOT NULL,
      region_key text NOT NULL,
      region_type text NOT NULL,
      period text NOT NULL,
      value real NOT NULL,
      meta text,
      fetched_at bigint NOT NULL,
      PRIMARY KEY (indicator, region_key, period)
    )`,
  ],
  [
    "radar_reports",
    `CREATE TABLE IF NOT EXISTS radar_reports (
      region_key text NOT NULL,
      range text NOT NULL,
      content text NOT NULL,
      generated_at bigint NOT NULL,
      PRIMARY KEY (region_key, range)
    )`,
  ],
];

const SQLITE_DDL = [
  `CREATE TABLE IF NOT EXISTS radar_series (
    indicator text NOT NULL,
    region_key text NOT NULL,
    region_type text NOT NULL,
    period text NOT NULL,
    value real NOT NULL,
    meta text,
    fetched_at integer NOT NULL,
    PRIMARY KEY (indicator, region_key, period)
  )`,
  `CREATE TABLE IF NOT EXISTS radar_reports (
    region_key text NOT NULL,
    range text NOT NULL,
    content text NOT NULL,
    generated_at integer NOT NULL,
    PRIMARY KEY (region_key, range)
  )`,
];

async function main() {
  if (process.env.DATABASE_URL) {
    // Pooler (-pooler) v transaction mode DDL tiše neaplikuje — DDL musí jít
    // přes přímé (non-pooler) připojení. Host má tvar "...pooler.c-4.eu-central-1..." —
    // odstraněním "-pooler" získáme direct připojení (zůstane ".c-4.").
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);
    for (const [name, ddl] of PG_TABLES) {
      await sql`${sql.unsafe(ddl)}`;
      console.log(`[Neon] ${name} zajištěna`);
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
      for (const ddl of SQLITE_DDL) {
        db.exec(ddl);
      }
      db.close();
      console.log("[SQLite] radar_series + radar_reports zajištěny");
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
