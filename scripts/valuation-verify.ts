/**
 * Verifikace oprav Odhadu:
 *  1) Travná (Kyje) — kompletní URL flow (parser + geokód + kotva + cap) → cíl ~8,4–8,8M
 *  2) K Lučinám (Žižkov) — beze změny (~129 588 Kč/m² bez kotvy)
 *  3) Cheb — regrese (okres/město úroveň)
 */
import "./_env";
import { scrapeUrl } from "../src/lib/scraping/url-scraper";
import { applyAreaResolution } from "../src/lib/scraping/area-resolver";
import { isSaleListing } from "../src/lib/scraping/filters";
import { classifyLocation } from "../src/lib/analysis/location";
import { cityKeyToName } from "../src/lib/geocode";
import { estimateProperty } from "../src/lib/valuation/engine";
import { clearCache } from "../src/lib/scraping/market-price-service";
import type { ValuationInput } from "../src/lib/valuation/types";

const URL = "https://www.bezrealitky.cz/nemovitosti-byty-domy/1051982-nabidka-prodej-bytu-travna-praha";

const fmt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("cs-CZ"));

function print(title: string, r: Awaited<ReturnType<typeof estimateProperty>>) {
  console.log(`\n=== ${title} ===`);
  console.log(`  Odhad: ${(r.estimate / 1_000_000).toFixed(3)} mil. Kč · ${fmt(r.pricePerSqm)} Kč/m²`);
  console.log(`  Rozmezí: ${(r.low / 1_000_000).toFixed(3)} – ${(r.high / 1_000_000).toFixed(3)} mil. · ${fmt(r.lowPerSqm)} – ${fmt(r.highPerSqm)} Kč/m²`);
  console.log(`  vsAskingPct: ${r.vsAskingPct} % · confidence: ${r.confidenceScore} (${r.confidenceLabel})`);
  for (const s of r.sources)
    console.log(`  zdroj: "${s.label}" · ${fmt(s.pricePerSqm)} Kč/m² · váha ${(s.weight * 100).toFixed(1)} % · vzorků ${s.sampleSize ?? "—"}`);
}

async function main() {
  clearCache();

  // ---------- 1) Travná — kompletní URL flow ----------
  console.log("========== 1) TRAVNÁ (Kyje) — URL flow ==========");
  const { listing: raw } = await scrapeUrl(URL);
  const { resolved: listing } = applyAreaResolution(raw);
  console.log("  parser:", {
    condition: listing.condition,
    buildingType: listing.buildingType,
    floor: listing.floor,
    totalFloors: listing.totalFloors,
    elevator: listing.elevator,
    ownership: listing.ownership,
    balconyArea: listing.balconyArea,
    cellarArea: listing.cellarArea,
    area: listing.area,
    price: listing.price,
    lat: listing.lat,
    lng: listing.lng,
  });
  const loc = classifyLocation(listing.address, listing.title);
  const input: ValuationInput = {
    address: listing.address,
    cityKey: loc.city !== "Neznámá" ? loc.city : "praha",
    cityName: loc.city !== "Neznámá" ? cityKeyToName(loc.city) : "Praha",
    type: "flat",
    disposition: listing.rooms,
    area: listing.area ?? undefined,
    condition: listing.condition ?? undefined,
    buildingType: listing.buildingType ?? undefined,
    category: loc.category ?? undefined,
    floor: typeof listing.floor === "number" && listing.floor >= 0 ? listing.floor : undefined,
    totalFloors: typeof listing.totalFloors === "number" && listing.totalFloors > 0 ? listing.totalFloors : undefined,
    elevator: listing.elevator ?? undefined,
    yearBuilt: typeof listing.yearBuilt === "number" ? listing.yearBuilt : undefined,
    ownership: listing.ownership ?? undefined,
    balconyArea: listing.balconyArea ?? undefined,
    cellarArea: listing.cellarArea ?? undefined,
    askingPrice: listing.price,
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
    lookbackMonths: 6,
  };
  const r1 = await estimateProperty(input);
  print("TRAVNÁ (Kyje) — cíl Valuo 7,883M", r1);
  console.log(`  ROZDÍL vs Valuo: ${(((r1.estimate - 7_883_337) / 7_883_337) * 100).toFixed(1)} %`);

  // ---------- 2) K Lučinám (Žižkov) — regrese kalibrace ----------
  // Reálný app tok (sreality URL) vždy dodá buildingType → segment panel_renovated.
  console.log("\n========== 2) K LUČINÁM (Žižkov) — regrese ==========");
  const r2 = await estimateProperty({
    cityKey: "praha",
    cityName: "Praha",
    address: "K Lučinám, Praha 3-Žižkov, Praha",
    type: "flat",
    disposition: "3+1",
    area: 73,
    condition: "good",
    buildingType: "panel",
    category: "stable",
    lat: 50.084,
    lng: 14.478,
    wardHints: ["Žižkov", "Praha 3"],
  });
  print("K LUČINÁM (panel) — cíl Valuo 9,375M (129 385/m²)", r2);

  const r2b = await estimateProperty({
    cityKey: "praha",
    cityName: "Praha",
    address: "K Lučinám, Praha 3-Žižkov, Praha",
    type: "flat",
    disposition: "3+1",
    area: 73,
    condition: "good",
    category: "stable",
    lat: 50.084,
    lng: 14.478,
    wardHints: ["Žižkov", "Praha 3"],
  });
  print("K LUČINÁM (bez buildingType — okrajový případ, clamp ±20 %)", r2b);

  // ---------- 3) Cheb — regrese ----------
  console.log("\n========== 3) CHEB — regrese ==========");
  const r3 = await estimateProperty({
    cityKey: "cheb",
    cityName: "Cheb",
    address: "Obrněné brigády, Cheb",
    type: "flat",
    disposition: "2+1",
    area: 55,
    condition: "good",
    buildingType: "brick",
  });
  print("CHEB (městská úroveň)", r3);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
