import { getPropertyMarketRange } from "../src/lib/scraping/market-price-service";

async function main() {
  const only = process.argv[2];
  const cities = only ? [only] : ["praha", "brno", "most"];
  for (const cityKey of cities) {
    const started = Date.now();
    console.log(`\n=== ${cityKey} ===`);
    try {
      const r = await getPropertyMarketRange({
        cityKey,
        condition: "good",
        buildingType: "brick",
        category: "stable",
      });
      console.log(
        r
          ? `low=${r.low} high=${r.high} median=${r.median} source=${r.source} n=${r.sampleSize} (${Date.now() - started}ms)`
          : "null"
      );
    } catch (err) {
      console.error(`ERROR: ${err}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
