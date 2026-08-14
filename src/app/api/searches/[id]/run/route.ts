import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { searches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { safeJsonParse } from "@/lib/utils";
import type { SearchFilters } from "@/lib/scraping/types";
import { createScrapingOrchestrator } from "@/lib/scraping/orchestrator-setup";

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
    const orchestrator = await createScrapingOrchestrator();

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