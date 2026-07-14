import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { searches } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const search = await db
      .select()
      .from(searches)
      .where(and(eq(searches.id, id), eq(searches.userId, userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!search) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let filters: Record<string, unknown> = {};
    try { filters = JSON.parse(search.filters); } catch { /* empty */ }

    const { ScrapingOrchestrator } = await import("@/lib/scraping/orchestrator");
    const { BazosAdapter } = await import("@/lib/scraping/adapters/bazos");
    const { MmrealityAdapter } = await import("@/lib/scraping/adapters/mmreality");
    const { AnnonceAdapter } = await import("@/lib/scraping/adapters/annonce");
    const { RealityCzAdapter } = await import("@/lib/scraping/adapters/reality-cz");
    const { HyperinzerceAdapter } = await import("@/lib/scraping/adapters/hyperinzerce");
    const { SrealityAdapter } = await import("@/lib/scraping/adapters/sreality");

    const orchestrator = new ScrapingOrchestrator();
    orchestrator.registerAdapter("bazos", new BazosAdapter());
    orchestrator.registerAdapter("mmreality", new MmrealityAdapter());
    orchestrator.registerAdapter("annonce", new AnnonceAdapter());
    orchestrator.registerAdapter("reality-cz", new RealityCzAdapter());
    orchestrator.registerAdapter("hyperinzerce", new HyperinzerceAdapter());
    orchestrator.registerAdapter("sreality", new SrealityAdapter());

    const result = await orchestrator.crawlSearch(id, filters as any);

    return NextResponse.json({
      success: true,
      total: result.total,
      errors: result.errors,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
