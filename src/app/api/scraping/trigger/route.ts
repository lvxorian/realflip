import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ScrapingOrchestrator } from "@/lib/scraping/orchestrator";
import { BazosAdapter } from "@/lib/scraping/adapters/bazos";
import { MmrealityAdapter } from "@/lib/scraping/adapters/mmreality";
import { AnnonceAdapter } from "@/lib/scraping/adapters/annonce";
import { RealityCzAdapter } from "@/lib/scraping/adapters/reality-cz";
import { HyperinzerceAdapter } from "@/lib/scraping/adapters/hyperinzerce";
import { SrealityAdapter } from "@/lib/scraping/adapters/sreality";
import { IdnesRealityAdapter } from "@/lib/scraping/adapters/idnes-reality";
import { RealityMatAdapter } from "@/lib/scraping/adapters/realitymat";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isExternalCron = cronSecret ? req.headers.get("x-cron-secret") === cronSecret : false;
  if (!isExternalCron) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const orchestrator = new ScrapingOrchestrator((portal, found, errors) => {
      console.log(`[scraping] ${portal}: ${found} listings, ${errors.length} errors`);
    });

    orchestrator.registerAdapter("bazos", new BazosAdapter());
    orchestrator.registerAdapter("mmreality", new MmrealityAdapter());
    orchestrator.registerAdapter("annonce", new AnnonceAdapter());
    orchestrator.registerAdapter("reality-cz", new RealityCzAdapter());
    orchestrator.registerAdapter("hyperinzerce", new HyperinzerceAdapter());
    orchestrator.registerAdapter("sreality", new SrealityAdapter());
    orchestrator.registerAdapter("idnes-reality", new IdnesRealityAdapter());
    orchestrator.registerAdapter("realitymat", new RealityMatAdapter());

    await orchestrator.crawlAllScheduled();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scraping trigger error:", error);
    return NextResponse.json(
      { error: "Scraping failed" },
      { status: 500 }
    );
  }
}
