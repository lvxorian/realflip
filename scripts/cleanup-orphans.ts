import "./_env";
import { neon } from "@neondatabase/serverless";

const TARGET_CITY_KEYS = ["praha", "cheb", "brno", "olomouc", "plzen", "karlovy_vary"];

const TARGET_TEXT = [
  "praha",
  "plze",
  "plzen",
  "brno",
  "olomouc",
  "cheb",
  "karlovy vary",
  "karlovyvary",
];

function normalize(s: string): string {
  const map: Record<string, string> = {
    á: "a", č: "c", ď: "d", é: "e", ě: "e", í: "i", ň: "n",
    ó: "o", ř: "r", š: "s", ť: "t", ú: "u", ů: "u", ý: "y", ž: "z",
    Á: "a", Č: "c", Ď: "d", É: "e", Ě: "e", Í: "i", Ň: "n",
    Ó: "o", Ř: "r", Š: "s", Ť: "t", Ú: "u", Ů: "u", Ý: "y", Ž: "z",
  };
  return s
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

function textHasTarget(text: string): boolean {
  const t = normalize(text);
  return TARGET_TEXT.some((word) => t.includes(word));
}

async function main() {
  const deleteMode = process.argv.includes("--delete");
  const sql = neon(process.env.DATABASE_URL!);

  const candidates = await sql.query(`
    SELECT p.id, p.portal_name, p.title, p.address, p.url,
           COALESCE(pa.location_city, '') AS location_city,
           p.is_active, p.first_seen, p.last_seen
    FROM properties p
    LEFT JOIN property_analysis pa ON pa.property_id = p.id
  `);

  const victims: any[] = [];
  const kept: any[] = [];

  for (const row of candidates) {
    const city = normalize(String(row.location_city ?? ""));
    const isTargetKey = TARGET_CITY_KEYS.includes(city);
    const isUnknown = city === "" || city === "neznámá" || city === "neznamna";
    const text = `${row.address ?? ""} ${row.title ?? ""}`;

    if (isTargetKey) {
      kept.push(row);
    } else if (isUnknown && textHasTarget(text)) {
      kept.push(row);
    } else {
      victims.push(row);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `scripts/backup-orphans-${ts}.json`;
  const fs = await import("node:fs");
  fs.writeFileSync(backupFile, JSON.stringify(victims, null, 1));

  const count = (rows: any[], active: boolean) =>
    rows.filter((r) => (active ? r.is_active === 1 : r.is_active !== 1)).length;

  console.log(`Candidates total: ${candidates.length}`);
  console.log(`Keep (target cities): ${kept.length} (active ${count(kept, true)})`);
  console.log(`Victims: ${victims.length} (active ${count(victims, true)}, inactive ${count(victims, false)})`);
  console.log(`Backup written: ${backupFile}`);

  const byCity: Record<string, number> = {};
  for (const v of victims) {
    const c = String(v.location_city || "(no analysis)");
    byCity[c] = (byCity[c] ?? 0) + 1;
  }
  console.log("\nVictims by city:");
  for (const [c, n] of Object.entries(byCity).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c}: ${n}`);
  }

  if (!deleteMode) {
    const keptUnknown = kept.filter((r) => {
      const c = normalize(String(r.location_city ?? ""));
      return c === "" || c === "neznámá" || c === "neznamna";
    });
    console.log(`\nKept "Neznámá" (address contains target city): ${keptUnknown.length}`);
    for (const r of keptUnknown.slice(0, 25)) {
      console.log(`  [${r.portal_name}] ${String(r.address).slice(0, 50)}`);
    }
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
