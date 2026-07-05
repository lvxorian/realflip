import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ScrapingOrchestrator } = await import("@/lib/scraping/orchestrator");
    const { MockAdapter } = await import("@/lib/scraping/adapters/mock");
    const { BazosAdapter } = await import("@/lib/scraping/adapters/bazos");

    const orchestrator = new ScrapingOrchestrator((portal, found, errors) => {
      console.log(`[scraping] ${portal}: ${found} listings, ${errors.length} errors`);
    });

    orchestrator.registerAdapter("bazos", new BazosAdapter());
    orchestrator.registerAdapter("annonce", new MockAdapter("annonce"));

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
