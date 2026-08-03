import "./_env";
import { neon } from "@neondatabase/serverless";
import { isSaleListing } from "../src/lib/scraping/filters";

async function main() {
  const deleteMode = process.argv.includes("--delete");
  const sql = neon(process.env.DATABASE_URL!);

  const rows: any[] = await sql.query(`
    SELECT p.id, p.portal_name, p.title, p.address, p.description, p.url, p.is_active
    FROM properties p
  `);

  const victims: any[] = [];
  const kept: any[] = [];

  for (const row of rows) {
    const sale = isSaleListing({
      title: row.title,
      address: row.address,
      description: row.description,
      url: row.url,
    });
    if (sale) {
      kept.push(row);
    } else {
      victims.push(row);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `scripts/backup-nonsale-${ts}.json`;
  const fs = await import("node:fs");
  fs.writeFileSync(backupFile, JSON.stringify(victims, null, 1));

  console.log(`Candidates total: ${rows.length}`);
  console.log(`Keep (sale listings): ${kept.length} (active ${kept.filter((r) => r.is_active === 1).length})`);
  console.log(`Victims (non-sale): ${victims.length} (active ${victims.filter((r) => r.is_active === 1).length})`);
  console.log(`Backup written: ${backupFile}`);

  console.log("\nVictims:");
  for (const v of victims.slice(0, 50)) {
    console.log(`  [${v.is_active === 1 ? "A" : " "}] [${v.portal_name}] ${String(v.title).slice(0, 70)}`);
  }
  if (victims.length > 50) console.log(`  ... and ${victims.length - 50} more`);

  if (!deleteMode) {
    console.log("\nDry run — nothing deleted. Add --delete to execute.");
    process.exit(0);
  }

  if (victims.length === 0) {
    console.log("Nothing to delete.");
    process.exit(0);
  }

  const ids = victims.map((v) => v.id);

  const deals = await sql.query(
    "SELECT COUNT(*) AS n FROM deals WHERE property_id = ANY($1::text[])",
    [ids]
  );
  const dealsN = Number(deals[0]?.n ?? 0);
  if (dealsN > 0) {
    console.error(`ABORT: ${dealsN} deals reference victim properties. Nothing deleted.`);
    process.exit(1);
  }

  const leads = await sql.query(
    "SELECT COUNT(*) AS n FROM leads WHERE property_id = ANY($1::text[])",
    [ids]
  );
  const leadsN = Number(leads[0]?.n ?? 0);
  console.log(`Leads referencing victims: ${leadsN}`);

  const deletes = [
    "DELETE FROM calculator_presets WHERE property_id = ANY($1::text[])",
    "DELETE FROM search_properties WHERE property_id = ANY($1::text[])",
    "DELETE FROM favorites WHERE property_id = ANY($1::text[])",
    "DELETE FROM leads WHERE property_id = ANY($1::text[])",
    "DELETE FROM price_history WHERE property_id = ANY($1::text[])",
    "DELETE FROM property_analysis WHERE property_id = ANY($1::text[])",
    "DELETE FROM activity_log WHERE property_id = ANY($1::text[])",
    "DELETE FROM properties WHERE id = ANY($1::text[])",
  ];

  let deleted = 0;
  for (const stmt of deletes) {
    const r = await sql.query(stmt, [ids]);
    deleted += Number(r.length ?? 0);
  }

  const after = await sql.query("SELECT COUNT(*) AS n FROM properties");
  console.log(`\nDeletion done. Remaining properties: ${after[0].n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});