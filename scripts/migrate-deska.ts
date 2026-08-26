import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: npx tsx scripts/migrate-deska.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

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
    scraped_at bigint NOT NULL,
    relevance text NOT NULL DEFAULT 'LOW',
    address text,
    lat real,
    lng real,
    property_id text,
    lead_id text,
    notes text,
    is_read integer NOT NULL DEFAULT 0,
    is_archived integer NOT NULL DEFAULT 0,
    raw_data jsonb DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS deska_watches (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    name text NOT NULL,
    keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
    category text,
    dashboard_ids jsonb DEFAULT '[]'::jsonb,
    region text,
    is_active integer NOT NULL DEFAULT 1,
    last_checked_at bigint,
    created_at bigint NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_deska_documents_category ON deska_documents(category)`,
  `CREATE INDEX IF NOT EXISTS idx_deska_documents_relevance ON deska_documents(relevance)`,
  `CREATE INDEX IF NOT EXISTS idx_deska_documents_scraped_at ON deska_documents(scraped_at)`,
  `CREATE INDEX IF NOT EXISTS idx_deska_documents_dashboard_id ON deska_documents(dashboard_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deska_documents_is_archived ON deska_documents(is_archived)`,
  `CREATE INDEX IF NOT EXISTS idx_deska_watches_user_id ON deska_watches(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deska_watches_is_active ON deska_watches(is_active)`,
];

(async () => {
  for (const stmt of statements) {
    const preview = stmt.trim().slice(0, 80).replace(/\n/g, " ");
    console.log(`Running: ${preview}...`);
    await sql.query(stmt);
    console.log("  OK");
  }
  console.log("\nMigration 0025_deska complete!");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
