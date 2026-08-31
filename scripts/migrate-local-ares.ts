import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data.db");
const db = new Database(dbPath);

const statements = [
  `CREATE TABLE IF NOT EXISTS ares_companies (
    id text PRIMARY KEY,
    ico text NOT NULL UNIQUE,
    name text,
    legal_form text,
    sidlo text,
    court text,
    spisova_znacka text,
    status text NOT NULL DEFAULT 'LIKVIDACE',
    liquidation_date integer,
    last_updated_ares integer,
    reasoning text,
    is_liquidating integer NOT NULL DEFAULT 1,
    has_execution integer NOT NULL DEFAULT 0,
    property_owned text DEFAULT '{}',
    property_verified integer NOT NULL DEFAULT 0,
    apartment_found integer NOT NULL DEFAULT 0,
    score integer NOT NULL DEFAULT 0,
    pipeline text NOT NULL DEFAULT 'new',
    notes_user text,
    contacted_at integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ares_polls (
    id text PRIMARY KEY,
    started_at integer NOT NULL,
    finished_at integer,
    last_batch_id integer,
    last_ico_index integer NOT NULL DEFAULT 0,
    companies_scanned integer NOT NULL DEFAULT 0,
    liquidations_found integer NOT NULL DEFAULT 0,
    apartments_found integer NOT NULL DEFAULT 0,
    error text,
    status text NOT NULL DEFAULT 'running'
  )`,
];

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_ares_companies_status ON ares_companies(status)",
  "CREATE INDEX IF NOT EXISTS idx_ares_companies_apartment_found ON ares_companies(apartment_found)",
  "CREATE INDEX IF NOT EXISTS idx_ares_companies_score ON ares_companies(score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_ares_companies_pipeline ON ares_companies(pipeline)",
  "CREATE INDEX IF NOT EXISTS idx_ares_polls_status ON ares_polls(status)",
];

db.exec("BEGIN");
try {
  for (const stmt of statements) db.exec(stmt);
  for (const idx of indexes) db.exec(idx);
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}

console.log("SQLite local migration complete (ares).");
db.close();
