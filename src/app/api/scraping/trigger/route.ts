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

    const orchestrator = new ScrapingOrchestrator((portal, found, errors) => {
      console.log(`[scraping] ${portal}: ${found} listings, ${errors.length} errors`);
    });

    orchestrator.registerAdapter("bazos", new BazosAdapter());
    orchestrator.registerAdapter("mmreality", new MmrealityAdapter());
    orchestrator.registerAdapter("annonce", new AnnonceAdapter());

    const result = await orchestrator.crawlAll();

    return NextResponse.json({
      success: true,
      total: result.total,
      errors: result.errors.length,
      errorDetails: result.errors,
    });
  } catch (error) {
    console.error("Scraping trigger error:", error);
    return NextResponse.json(
      { error: "Scraping failed", detail: String(error) },
      { status: 500 }
    );
  }
}
