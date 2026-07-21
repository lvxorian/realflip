import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ScrapingOrchestrator } from "@/lib/scraping/orchestrator";
import { BazosAdapter } from "@/lib/scraping/adapters/bazos";
import { MmrealityAdapter } from "@/lib/scraping/adapters/mmreality";
import { AnnonceAdapter } from "@/lib/scraping/adapters/annonce";
import { RealityCzAdapter } from "@/lib/scraping/adapters/reality-cz";
import { HyperinzerceAdapter } from "@/lib/scraping/adapters/hyperinzerce";
import { SrealityAdapter } from "@/lib/scraping/adapters/sreality";

export async function POST(req: Request) {
  const isCron = req.headers.get("x-vercel-cron") === "1";
  if (!isCron) {
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
