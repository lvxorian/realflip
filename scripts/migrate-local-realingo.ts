import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data.db");
const db = new Database(dbPath);

const statements = [
  `CREATE TABLE IF NOT EXISTS realingo_account (
    id text PRIMARY KEY,
    enabled integer NOT NULL DEFAULT 0,
    address text NOT NULL DEFAULT 'Praha',
    purpose text NOT NULL DEFAULT 'SELL',
    property text NOT NULL DEFAULT 'FLAT',
    building_statuses text NOT NULL DEFAULT '[]',
    sort text NOT NULL DEFAULT 'NEWEST',
    first integer NOT NULL DEFAULT 40,
    max_age integer,
    last_sync_at integer,
    last_total integer NOT NULL DEFAULT 0,
    last_locked integer NOT NULL DEFAULT 0,
    last_error text,
    updated_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS realingo_scans (
    id text PRIMARY KEY,
    property_id text NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    offer_id text,
    scan_id text NOT NULL,
    status text,
    result_json text,
    price_index_json text,
    comparables_json text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `ALTER TABLE properties ADD COLUMN realingo_id text`,
  `ALTER TABLE properties ADD COLUMN price_rating text`,
  `ALTER TABLE properties ADD COLUMN price_tier text`,
  `ALTER TABLE properties ADD COLUMN price_rating_json text`,
  `ALTER TABLE properties ADD COLUMN is_early_offer integer DEFAULT 0`,
  `ALTER TABLE properties ADD COLUMN realingo_synced_at integer`,
];

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_properties_realingo_id ON properties(realingo_id)",
];

db.exec("BEGIN");
try {
  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (e) {
      // ALTER TABLE DROP/ADD duplicate column -> "duplicate column name"; ignore.
      const msg = String((e as Error).message ?? "");
      if (!/duplicate column/i.test(msg)) throw e;
    }
  }
  for (const idx of indexes) db.exec(idx);
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}

console.log("SQLite local migration complete (realingo).");
db.close();
