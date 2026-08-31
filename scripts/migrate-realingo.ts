import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: npx tsx scripts/migrate-realingo.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS realingo_account (
    id text PRIMARY KEY,
    enabled integer NOT NULL DEFAULT 0,
    address text NOT NULL DEFAULT 'Praha',
    purpose text NOT NULL DEFAULT 'SELL',
    property text NOT NULL DEFAULT 'FLAT',
    building_statuses jsonb NOT NULL DEFAULT '[]'::jsonb,
    sort text NOT NULL DEFAULT 'NEWEST',
    first integer NOT NULL DEFAULT 40,
    max_age integer,
    last_sync_at bigint,
    last_total integer NOT NULL DEFAULT 0,
    last_locked integer NOT NULL DEFAULT 0,
    last_error text,
    updated_at bigint NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS realingo_scans (
    id text PRIMARY KEY,
    property_id text NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    offer_id text,
    scan_id text NOT NULL,
    status text,
    result_json jsonb,
    price_index_json jsonb,
    comparables_json jsonb,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
  )`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS realingo_id text`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_rating text`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_tier text`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_rating_json jsonb`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_early_offer integer DEFAULT 0`,
  `ALTER TABLE properties ADD COLUMN IF NOT EXISTS realingo_synced_at bigint`,
  `CREATE INDEX IF NOT EXISTS idx_properties_realingo_id ON properties(realingo_id)`,
];

(async () => {
  for (const stmt of statements) {
    const preview = stmt.trim().slice(0, 80).replace(/\n/g, " ");
    console.log(`Running: ${preview}...`);
    await sql.query(stmt);
    console.log("  OK");
  }
  console.log("\nMigration realingo complete!");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
