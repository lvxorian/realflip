import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ScrapingOrchestrator } = await import("@/lib/scraping/orchestrator");
    const orchestrator = new ScrapingOrchestrator();

    const result = await orchestrator.crawlAll();

    return NextResponse.json({
      success: true,
      total: result.total,
      errors: result.errors.length,
    });
  } catch (error) {
    console.error("Scraping trigger error:", error);
    return NextResponse.json(
      { error: "Scraping failed" },
      { status: 500 }
    );
  }
}
