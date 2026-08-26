import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: npx tsx scripts/migrate-isir.ts <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS insolvency_events (
    id text PRIMARY KEY,
    podnet_id bigint NOT NULL UNIQUE,
    spisova_znacka text NOT NULL,
    court text,
    event_type text NOT NULL,
    event_desc text,
    section text,
    section_order integer,
    document_url text,
    notes text,
    published_at bigint NOT NULL,
    apartment_found integer NOT NULL DEFAULT 0,
    apartment_data jsonb DEFAULT '{}'::jsonb,
    score integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'new',
    notes_user text,
    contacted_at bigint,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS isir_polls (
    id text PRIMARY KEY,
    started_at bigint NOT NULL,
    finished_at bigint,
    last_podnet_id bigint,
    events_found integer NOT NULL DEFAULT 0,
    apartments_found integer NOT NULL DEFAULT 0,
    error text,
    status text NOT NULL DEFAULT 'running'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_insolvency_events_podnet_id ON insolvency_events(podnet_id)`,
  `CREATE INDEX IF NOT EXISTS idx_insolvency_events_spisova_znacka ON insolvency_events(spisova_znacka)`,
  `CREATE INDEX IF NOT EXISTS idx_insolvency_events_section ON insolvency_events(section)`,
  `CREATE INDEX IF NOT EXISTS idx_insolvency_events_score ON insolvency_events(score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_insolvency_events_apartment_found ON insolvency_events(apartment_found)`,
  `CREATE INDEX IF NOT EXISTS idx_insolvency_events_status ON insolvency_events(status)`,
  `CREATE INDEX IF NOT EXISTS idx_isir_polls_status ON isir_polls(status)`,
  `CREATE INDEX IF NOT EXISTS idx_isir_polls_started_at ON isir_polls(started_at DESC)`,
];

(async () => {
  for (const stmt of statements) {
    const preview = stmt.trim().slice(0, 80).replace(/\n/g, " ");
    console.log(`Running: ${preview}...`);
    await sql.query(stmt);
    console.log("  OK");
  }
  console.log("\nMigration 0026_isir complete!");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
