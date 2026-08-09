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

  // Kyje — Travná (77 m²)
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
  const tx2 = r2.comparables.filter((c) => c.addressTx);
  console.log(`Adresních transakcí: ${tx2.length}`);
  for (const t of tx2.slice(0, 5)) {
    console.log(
      `  ${t.label} | ${t.area ?? "?"} m² | ${t.distanceKm?.toFixed(2) ?? "?"} km | ${t.soldAt ? new Date(t.soldAt).toLocaleDateString("cs-CZ") : "?"}`
    );
  }
}

main().catch((e) => {
  console.error("CHYBA:", e);
  process.exit(1);
});
