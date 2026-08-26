import { neon } from "@neondatabase/serverless";

const url = process.env.MIGRATE_DB_URL;
if (!url) { console.error("Set MIGRATE_DB_URL"); process.exit(1); }
const sql = neon(url);

(async () => {
  const r1 = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deska_documents' ORDER BY ordinal_position`;
  console.log(`deska_documents: ${r1.length} columns`);
  for (const r of r1) console.log(`  ${r.column_name} ${r.data_type}`);

  const r2 = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deska_watches' ORDER BY ordinal_position`;
  console.log(`\ndeska_watches: ${r2.length} columns`);
  for (const r of r2) console.log(`  ${r.column_name} ${r.data_type}`);

  const r3 = await sql`SELECT count(*) as n FROM deska_documents`;
  console.log(`\ndeska_documents rows: ${r3[0].n}`);
  const r4 = await sql`SELECT count(*) as n FROM deska_watches`;
  console.log(`deska_watches rows: ${r4[0].n}`);

  const r5 = await sql`SELECT indexname FROM pg_indexes WHERE tablename IN ('deska_documents', 'deska_watches') ORDER BY indexname`;
  console.log(`\nIndexes (${r5.length}):`);
  for (const r of r5) console.log(`  ${r.indexname}`);
})();
})();
