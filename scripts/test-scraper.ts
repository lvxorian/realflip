import { ScrapingOrchestrator } from "../src/lib/scraping/orchestrator";
import { MockAdapter } from "../src/lib/scraping/adapters/mock";
import { BazosAdapter } from "../src/lib/scraping/adapters/bazos";
import { db } from "../src/db";
import { properties, scrapingJobs, activityLog } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== RealFlip Scraper Test ===\n");

  const orchestrator = new ScrapingOrchestrator((portal, found, errors) => {
    console.log(`[${portal}] found=${found} errors=${errors.length}`);
    errors.forEach((e) => console.log(`  ERROR: ${e}`));
  });

  orchestrator.registerAdapter("bazos", new BazosAdapter());
  orchestrator.registerAdapter("annonce", new MockAdapter("annonce"));

  console.log("Registered adapters:");
  console.log("  - bazos: BazosAdapter (real, /prodam/byt/)");
  console.log("  - annonce: MockAdapter (test data)");
  console.log("Starting crawl...\n");

  const start = Date.now();
  const result = await orchestrator.crawlAll();
  const elapsed = Date.now() - start;

  console.log(`\n=== Crawl finished in ${elapsed}ms ===`);
  console.log(`Total new listings saved: ${result.total}`);
  console.log(`Total errors: ${result.errors.length}`);
  if (result.errors.length > 0) {
    console.log("Errors:");
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log("\n=== Verifying DB ===");

  for (const portal of ["bazos", "annonce"]) {
    const props = await db
      .select({
        id: properties.id,
        title: properties.title,
        url: properties.url,
        price: properties.price,
        portalName: properties.portalName,
        imageUrls: properties.imageUrls,
      })
      .from(properties)
      .where(eq(properties.portalName, portal));

    console.log(`\n${portal} properties in DB: ${props.length}`);
    props.slice(0, 5).forEach((p: { id: string; title: string; url: string; price: number; portalName: string; imageUrls: string | null }) => {
      const imgs = p.imageUrls ? JSON.parse(p.imageUrls) : [];
      console.log(`  - ${p.id.slice(0, 12)} | ${p.title.slice(0, 50)} | ${p.price} Kc | ${imgs.length} images`);
    });
    if (props.length > 5) console.log(`  ... and ${props.length - 5} more`);
  }

  const jobs = await db.select().from(scrapingJobs);
  console.log(`\nScraping jobs logged: ${jobs.length}`);
  jobs.forEach((j: { id: string; portal: string; status: string; listingsFound: number | null }) => {
    console.log(
      `  - ${j.id.slice(0, 8)} | ${j.portal} | ${j.status} | found=${j.listingsFound ?? 0}`
    );
  });

  console.log("\n=== Test complete ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
