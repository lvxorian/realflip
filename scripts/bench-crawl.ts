/**
 * Bench crawl adaptérů — změří, kolik stránek/inzerátů portál stihne za
 * simulovaný budget (výchozí 45 s = reálný deadline hromadného hledání).
 *
 * Použití:
 *   npm run bench:crawl                     # všechny portály, 45 s, celá ČR
 *   npm run bench:crawl -- bazos            # jen bazos
 *   npm run bench:crawl -- sreality praha   # jen sreality pro město Praha
 *   npm run bench:crawl -- --budget 60 --portals bazos,annonce
 *
 * Běh je read-only vůči DB — načtou se jen známé URL (skipDetailForUrls),
 * nic se neukládá. Hodí se ověřit, že portál doběhne do limitu a kolik
 * detail fetchů se přeskočí (známé inzeráty z DB).
 */
import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { BazosAdapter } from "../src/lib/scraping/adapters/bazos";
import { MmrealityAdapter } from "../src/lib/scraping/adapters/mmreality";
import { AnnonceAdapter } from "../src/lib/scraping/adapters/annonce";
import { RealityCzAdapter } from "../src/lib/scraping/adapters/reality-cz";
import { HyperinzerceAdapter } from "../src/lib/scraping/adapters/hyperinzerce";
import { SrealityAdapter } from "../src/lib/scraping/adapters/sreality";
import { IdnesRealityAdapter } from "../src/lib/scraping/adapters/idnes-reality";
import { RealityMatAdapter } from "../src/lib/scraping/adapters/realitymat";
import { RealityMixAdapter } from "../src/lib/scraping/adapters/realitymix";
import { BezrealitkyAdapter } from "../src/lib/scraping/adapters/bezrealitky";
import { RemaxAdapter } from "../src/lib/scraping/adapters/remax";
import { PortalAdapter, CrawlStep } from "../src/lib/scraping/adapters/base";
import { PORTAL_CONFIGS, PortalName } from "../src/lib/scraping/types";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const portalsArg = args.includes("--portals")
  ? (args[args.indexOf("--portals") + 1] ?? "").split(",").filter(Boolean)
  : positional.length > 0
    ? [positional[0]]
    : [];
const cityArg = args.includes("--city")
  ? args[args.indexOf("--city") + 1] ?? null
  : positional[1] ?? null;
const budgetIdx = args.indexOf("--budget");
const budgetSec = budgetIdx >= 0 ? parseInt(args[budgetIdx + 1] ?? "45", 10) : 45;

function buildAdapters(): Map<PortalName, PortalAdapter> {
  const map = new Map<PortalName, PortalAdapter>();
  const registrations: [PortalName, PortalAdapter][] = [
    ["bazos", new BazosAdapter()],
    ["mmreality", new MmrealityAdapter()],
    ["annonce", new AnnonceAdapter()],
    ["reality-cz", new RealityCzAdapter()],
    ["hyperinzerce", new HyperinzerceAdapter()],
    ["sreality", new SrealityAdapter()],
    ["idnes-reality", new IdnesRealityAdapter()],
    ["realitymat", new RealityMatAdapter()],
    ["realitymix", new RealityMixAdapter()],
    ["bezrealitky", new BezrealitkyAdapter()],
    ["remax", new RemaxAdapter()],
  ];
  for (const [name, adapter] of registrations) map.set(name, adapter);
  return map;
}

async function main() {
  const adapters = buildAdapters();

  const rows = await db
    .select({ url: properties.url })
    .from(properties)
    .where(eq(properties.isActive, 1))
    .limit(20000);
  const knownUrls = new Set(rows.map((r) => r.url));
  console.log(`Známých URL v DB: ${knownUrls.size}`);

  const enabled = (Object.keys(PORTAL_CONFIGS) as PortalName[]).filter(
    (p) => PORTAL_CONFIGS[p].enabled
  );
  const targets = portalsArg.length > 0
    ? enabled.filter((p) => portalsArg.includes(p))
    : enabled;

  for (const portal of targets) {
    const adapter = adapters.get(portal);
    if (!adapter) {
      console.log(`\n=== ${portal}: NENÍ ZAREGISTROVANÝ, přeskočeno ===`);
      continue;
    }
    adapter.skipDetailForUrls = knownUrls;
    adapter.setKnownUrls?.(knownUrls);

    const deadline = Date.now() + budgetSec * 1000;
    const stepsDone: number[] = [];
    const ctx: CrawlStep = {
      startStep: 0,
      deadlineMs: deadline,
      completed: true,
      onStepDone: (s) => stepsDone.push(s),
    };

    const started = Date.now();
    let listings: Awaited<ReturnType<PortalAdapter["crawlListings"]>> = [];
    let error: unknown = null;
    try {
      if (cityArg && typeof adapter.crawlCityListings === "function") {
        listings = await adapter.crawlCityListings(cityArg.replace(/\s+/g, "_"), undefined, ctx);
      } else {
        listings = await adapter.crawlListings(
          cityArg ? { location: cityArg } : undefined,
          ctx
        );
      }
    } catch (e) {
      error = e;
    }
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    const newUrls = listings.filter((l) => !knownUrls.has(l.url)).length;
    console.log(
      `\n=== ${portal}${cityArg ? ` (město: ${cityArg})` : ""} ===` +
        `\n  čas: ${elapsed}s / budget ${budgetSec}s` +
        `\n  nalezeno: ${listings.length} (z toho nových: ${newUrls})` +
        `\n  kroky (stránky): ${stepsDone.join(", ") || "žádné"}` +
        `\n  dokončeno: ${ctx.completed}` +
        (error ? `\n  chyba: ${String(error)}` : "")
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});