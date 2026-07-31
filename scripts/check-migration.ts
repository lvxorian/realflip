import { db } from "../src/db";

async function main() {
  const r = await db.execute(`
    SELECT p.id, pa.location_city, p.address, p.url
    FROM properties p
    LEFT JOIN property_analysis pa ON pa.property_id = p.id
    WHERE p.is_active = 1 AND (pa.updated_at IS NULL OR pa.updated_at < ${Date.now() - 24 * 3600 * 1000})
  `);
  for (const row of r.rows as any[]) {
    console.log(`${String(row.id).slice(0, 12)} | ${row.location_city ?? "null"} | ${String(row.address).slice(0, 40)} | ${String(row.url).slice(0, 60)}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
