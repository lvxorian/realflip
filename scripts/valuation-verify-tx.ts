/**
 * Živé ověření Fáze 2 — odhad s adresními transakcemi (estate_list) v komparacích.
 * Spustit: npx tsx scripts/valuation-verify-tx.ts
 */
import { estimateProperty } from "../src/lib/valuation/engine";

async function main() {
  // Žižkov — byt K Lučinám (s adresou → čtvrť + adresní transakce)
  console.log("=== Praha, Žižkov (K Lučinám, 73 m²) ===");
  const r1 = await estimateProperty({
    cityKey: "praha",
    address: "K Lučinám, Praha - Žižkov, Praha",
    wardHints: ["Žižkov", "Praha 3"],
    type: "flat",
    area: 73,
    condition: "good",
    buildingType: "panel",
    yearBuilt: 1980,
    floor: 2,
    totalFloors: 5,
    elevator: false,
    ownership: "personal",
    lat: 50.0899,
    lng: 14.4686,
  });
  console.log(`Odhad: ${r1.estimate.toLocaleString("cs-CZ")} Kč (${r1.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²)`);
  console.log(`Komparace celkem: ${r1.comparables.length}`);
  const tx1 = r1.comparables.filter((c) => c.addressTx);
  console.log(`Adresních transakcí: ${tx1.length}`);
  for (const t of tx1.slice(0, 5)) {
    console.log(
      `  ${t.label} | ${t.area ?? "?"} m² | ${t.distanceKm?.toFixed(2) ?? "?"} km | ${t.soldAt ? new Date(t.soldAt).toLocaleDateString("cs-CZ") : "?"}`
    );
  }

  // Kyje — Travná (77 m²) — s rozmezím (spread po Fázi A)
  console.log("\n=== Praha, Kyje (Travná, 77 m²) ===");
  const r2 = await estimateProperty({
    cityKey: "praha",
    address: "Travná, Praha - Kyje, Praha",
    wardHints: ["Kyje", "Jahodnice"],
    type: "flat",
    area: 77,
    condition: "renovated",
    buildingType: "panel",
    floor: 3,
    totalFloors: 5,
    elevator: false,
    ownership: "personal",
    askingPrice: 8_990_000,
  });
  console.log(`Odhad: ${r2.estimate.toLocaleString("cs-CZ")} Kč (${r2.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²)`);
  console.log(`Rozmezí: ${r2.low.toLocaleString("cs-CZ")} – ${r2.high.toLocaleString("cs-CZ")} (±${((r2.high - r2.low) / 2 / r2.estimate * 100).toFixed(1)} %)`);
  const realized2 = r2.sources.find((s) => s.key === "realized");
  console.log(`Realizované: ${realized2?.pricePerSqm?.toLocaleString("cs-CZ") ?? "—"} Kč/m² (${realized2?.sampleSize ?? 0} tx) — ${realized2?.label ?? ""}`);
  const tx2 = r2.comparables.filter((c) => c.addressTx);
  console.log(`Adresních transakcí: ${tx2.length}`);

  // Vinohrady — prémiová čtvrť: category premium se NESMÍ započítat ×1,2 (BUG 1)
  console.log("\n=== Praha, Vinohrady (premium, 60 m²) ===");
  const r3 = await estimateProperty({
    cityKey: "praha",
    address: "Vinohradská, Praha 2 - Vinohrady, Praha",
    wardHints: ["Vinohrady", "Praha 2"],
    type: "flat",
    area: 60,
    condition: "good",
    buildingType: "brick",
    category: "premium",
  });
  const realized3 = r3.sources.find((s) => s.key === "realized");
  console.log(`Odhad: ${r3.estimate.toLocaleString("cs-CZ")} Kč (${r3.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²)`);
  console.log(`Realizované: ${realized3?.pricePerSqm?.toLocaleString("cs-CZ") ?? "—"} Kč/m² (${realized3?.sampleSize ?? 0} tx) — ${realized3?.label ?? ""}`);
  console.log(`Metodika obsahuje 'lokalita'? ${r3.methodology.join(" ").includes("lokalita") ? "ANO (chyba!)" : "ne ✓"}`);

  // Černý Most — riziková čtvrť: category risky se NESMÍ započítat ×0,7 (BUG 1)
  console.log("\n=== Praha, Černý Most (risky, 65 m²) ===");
  const r4 = await estimateProperty({
    cityKey: "praha",
    address: "Bryksova, Praha 14 - Černý Most, Praha",
    wardHints: ["Černý Most", "Praha 14"],
    type: "flat",
    area: 65,
    condition: "good",
    buildingType: "panel",
    category: "risky",
  });
  const realized4 = r4.sources.find((s) => s.key === "realized");
  console.log(`Odhad: ${r4.estimate.toLocaleString("cs-CZ")} Kč (${r4.pricePerSqm.toLocaleString("cs-CZ")} Kč/m²)`);
  console.log(`Realizované: ${realized4?.pricePerSqm?.toLocaleString("cs-CZ") ?? "—"} Kč/m² (${realized4?.sampleSize ?? 0} tx) — ${realized4?.label ?? ""}`);
}

main().catch((e) => {
  console.error("CHYBA:", e);
  process.exit(1);
});
