import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ScrapingOrchestrator } = await import("@/lib/scraping/orchestrator");
    const { BazosAdapter } = await import("@/lib/scraping/adapters/bazos");
    const { MmrealityAdapter } = await import("@/lib/scraping/adapters/mmreality");
    const { AnnonceAdapter } = await import("@/lib/scraping/adapters/annonce");
    const { RealityCzAdapter } = await import("@/lib/scraping/adapters/reality-cz");
    const { HyperinzerceAdapter } = await import("@/lib/scraping/adapters/hyperinzerce");
    const { SrealityAdapter } = await import("@/lib/scraping/adapters/sreality");
 
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
