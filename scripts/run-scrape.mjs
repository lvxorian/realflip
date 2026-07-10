import { BazosAdapter } from "../src/lib/scraping/adapters/bazos.js";
import { MmrealityAdapter } from "../src/lib/scraping/adapters/mmreality.js";
import { AnnonceAdapter } from "../src/lib/scraping/adapters/annonce.js";
import { RealityCzAdapter } from "../src/lib/scraping/adapters/reality-cz.js";
import { HyperinzerceAdapter } from "../src/lib/scraping/adapters/hyperinzerce.js";
import { ScrapingOrchestrator } from "../src/lib/scraping/orchestrator.js";
import { PORTAL_CONFIGS } from "../src/lib/scraping/types.js";

const orchestrator = new ScrapingOrchestrator((portal, found, errors) => {
  console.log(`[${portal}] ${found} listings, ${errors.length} errors`);
  for (const e of errors) console.error(`  ERROR: ${e}`);
});

orchestrator.registerAdapter("bazos", new BazosAdapter(2));
orchestrator.registerAdapter("mmreality", new MmrealityAdapter(2));
orchestrator.registerAdapter("annonce", new AnnonceAdapter(2));
orchestrator.registerAdapter("reality-cz", new RealityCzAdapter(2));
orchestrator.registerAdapter("hyperinzerce", new HyperinzerceAdapter(2));

console.log("Scraping started...");
const result = await orchestrator.crawlAll();
console.log(`\nDone! Total: ${result.total}, Errors: ${result.errors.length}`);
for (const e of result.errors) console.error(`  ERROR: ${e}`);
process.exit(0);
