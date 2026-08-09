/**
 * Živé ověření fetchWardTransactions — adresní transakce z cenové mapy.
 * Spustit: npx tsx scripts/valuation-ward-tx.ts
 */
import { fetchWardTransactions } from "../src/lib/valuation/price-map";

async function main() {
  // 1) Praha — Žižkov (s adresou, jako z formuláře Odhadu)
  console.log("=== Praha, Žižkov (K Lučinám) ===");
  const tx1 = await fetchWardTransactions("praha", {
    address: "K Lučinám, Praha - Žižkov, Praha",
    wardHints: ["Žižkov", "Praha 3"],
  });
  console.log(`transakcí: ${tx1.length}`);
  for (const t of tx1.slice(0, 5)) {
    console.log(
      `  ${t.housenumber ?? "?"} | ${t.lat?.toFixed(5)},${t.lng?.toFixed(5)} | ${t.areaCategory} | ${t.validationDate}`
    );
  }

  // 2) Praha — Kyje (Travná)
  console.log("\n=== Praha, Kyje (Travná) ===");
  const tx2 = await fetchWardTransactions("praha", {
    address: "Travná, Praha - Kyje, Praha",
    wardHints: ["Kyje", "Jahodnice"],
  });
  console.log(`transakcí: ${tx2.length}`);
  for (const t of tx2.slice(0, 5)) {
    console.log(
      `  ${t.housenumber ?? "?"} | ${t.lat?.toFixed(5)},${t.lng?.toFixed(5)} | ${t.areaCategory} | ${t.validationDate}`
    );
  }

  // 3) Cheb — městská část Cheb
  console.log("\n=== Cheb ===");
  const tx3 = await fetchWardTransactions("cheb", { address: "Cheb, okres Cheb" });
  console.log(`transakcí: ${tx3.length}`);
  for (const t of tx3.slice(0, 5)) {
    console.log(
      `  ${t.housenumber ?? "?"} | ${t.lat?.toFixed(5)},${t.lng?.toFixed(5)} | ${t.areaCategory} | ${t.validationDate}`
    );
  }
}

main().catch((e) => {
  console.error("CHYBA:", e);
  process.exit(1);
});
