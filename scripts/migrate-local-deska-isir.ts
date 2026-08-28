import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data.db");
const db = new Database(dbPath);

const statements = [
  `CREATE TABLE IF NOT EXISTS deska_documents (
    id text PRIMARY KEY,
    edesky_id text NOT NULL UNIQUE,
    name text NOT NULL,
    dashboard_name text,
    dashboard_id text,
    category text NOT NULL DEFAULT 'JINE',
    keywords_matched text,
    orig_url text,
    edesky_url text,
    text_content text,
    created_at_deska text,
    scraped_at integer NOT NULL,
    relevance text NOT NULL DEFAULT 'LOW',
    address text,
    lat real,
    lng real,
    property_id text,
    lead_id text,
    notes text,
    is_read integer NOT NULL DEFAULT 0,
    is_archived integer NOT NULL DEFAULT 0,
    raw_data text DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS deska_watches (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    name text NOT NULL,
    keywords text NOT NULL DEFAULT '[]',
    category text,
    dashboard_ids text DEFAULT '[]',
    region text,
    is_active integer NOT NULL DEFAULT 1,
    last_checked_at integer,
    created_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS insolvency_events (
    id text PRIMARY KEY,
    podnet_id integer NOT NULL UNIQUE,
    spisova_znacka text NOT NULL,
    court text,
    event_type text NOT NULL,
    event_desc text,
    section text,
    section_order integer,
    document_url text,
    notes text,
    published_at integer NOT NULL,
    apartment_found integer NOT NULL DEFAULT 0,
    apartment_data text DEFAULT '{}',
    score integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'new',
    notes_user text,
    contacted_at integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS isir_polls (
    id text PRIMARY KEY,
    started_at integer NOT NULL,
    finished_at integer,
    last_podnet_id integer,
    events_found integer NOT NULL DEFAULT 0,
    apartments_found integer NOT NULL DEFAULT 0,
    error text,
    status text NOT NULL DEFAULT 'running'
  )`,
];

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_deska_documents_category ON deska_documents(category)",
  "CREATE INDEX IF NOT EXISTS idx_deska_documents_relevance ON deska_documents(relevance)",
  "CREATE INDEX IF NOT EXISTS idx_deska_documents_scraped_at ON deska_documents(scraped_at)",
  "CREATE INDEX IF NOT EXISTS idx_deska_documents_is_archived ON deska_documents(is_archived)",
  "CREATE INDEX IF NOT EXISTS idx_deska_watches_user_id ON deska_watches(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_insolvency_events_spisova_znacka ON insolvency_events(spisova_znacka)",
  "CREATE INDEX IF NOT EXISTS idx_insolvency_events_section ON insolvency_events(section)",
  "CREATE INDEX IF NOT EXISTS idx_insolvency_events_score ON insolvency_events(score DESC)",
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

console.log("SQLite local migration complete (deska + isir).");
db.close();
