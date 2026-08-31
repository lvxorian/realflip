import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: npx tsx scripts/migrate-ares.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

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
    liquidation_date bigint,
    last_updated_ares bigint,
    reasoning text,
    is_liquidating integer NOT NULL DEFAULT 1,
    has_execution integer NOT NULL DEFAULT 0,
    property_owned jsonb DEFAULT '{}'::jsonb,
    property_verified integer NOT NULL DEFAULT 0,
    apartment_found integer NOT NULL DEFAULT 0,
    score integer NOT NULL DEFAULT 0,
    pipeline text NOT NULL DEFAULT 'new',
    notes_user text,
    contacted_at bigint,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ares_polls (
    id text PRIMARY KEY,
    started_at bigint NOT NULL,
    finished_at bigint,
    last_batch_id integer,
    last_ico_index integer NOT NULL DEFAULT 0,
    companies_scanned integer NOT NULL DEFAULT 0,
    liquidations_found integer NOT NULL DEFAULT 0,
    apartments_found integer NOT NULL DEFAULT 0,
    error text,
    status text NOT NULL DEFAULT 'running'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ares_companies_status ON ares_companies(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ares_companies_apartment_found ON ares_companies(apartment_found)`,
  `CREATE INDEX IF NOT EXISTS idx_ares_companies_score ON ares_companies(score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ares_companies_pipeline ON ares_companies(pipeline)`,
  `CREATE INDEX IF NOT EXISTS idx_ares_polls_status ON ares_polls(status)`,
];

(async () => {
  for (const stmt of statements) {
    const preview = stmt.trim().slice(0, 80).replace(/\n/g, " ");
    console.log(`Running: ${preview}...`);
    await sql.query(stmt);
    console.log("  OK");
  }
  console.log("\nMigration ares (Likvidace) complete!");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
