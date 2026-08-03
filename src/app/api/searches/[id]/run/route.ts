import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { searches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { safeJsonParse } from "@/lib/utils";
import type { SearchFilters } from "@/lib/scraping/types";

export const maxDuration = 60;

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

    const filters = safeJsonParse<SearchFilters>(search.filters, {});

    const { ScrapingOrchestrator } = await import("@/lib/scraping/orchestrator");
    const { BazosAdapter } = await import("@/lib/scraping/adapters/bazos");
    const { MmrealityAdapter } = await import("@/lib/scraping/adapters/mmreality");
    const { AnnonceAdapter } = await import("@/lib/scraping/adapters/annonce");
    const { RealityCzAdapter } = await import("@/lib/scraping/adapters/reality-cz");
    const { HyperinzerceAdapter } = await import("@/lib/scraping/adapters/hyperinzerce");
    const { SrealityAdapter } = await import("@/lib/scraping/adapters/sreality");
    const { IdnesRealityAdapter } = await import("@/lib/scraping/adapters/idnes-reality");
    const { RealityMatAdapter } = await import("@/lib/scraping/adapters/realitymat");

    const orchestrator = new ScrapingOrchestrator();
    orchestrator.registerAdapter("bazos", new BazosAdapter());
    orchestrator.registerAdapter("mmreality", new MmrealityAdapter());
    orchestrator.registerAdapter("annonce", new AnnonceAdapter());
    orchestrator.registerAdapter("reality-cz", new RealityCzAdapter());
    orchestrator.registerAdapter("hyperinzerce", new HyperinzerceAdapter());
    orchestrator.registerAdapter("sreality", new SrealityAdapter());
    orchestrator.registerAdapter("idnes-reality", new IdnesRealityAdapter());
    orchestrator.registerAdapter("realitymat", new RealityMatAdapter());

    const result = await orchestrator.crawlSearch(id, filters);

    return NextResponse.json({
      success: true,
      total: result.total,
      errors: result.errors,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
