import { auth } from "@/lib/auth";
import { db } from "@/db";
import { searches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { safeJsonParse } from "@/lib/utils";
import type { SearchFilters } from "@/lib/scraping/types";
import { createScrapingOrchestrator } from "@/lib/scraping/orchestrator-setup";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Jednotlivé skenování hledání streamované jako SSE — UI vidí živý průběh per portál. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const search = await db
    .select()
    .from(searches)
    .where(and(eq(searches.id, id), eq(searches.userId, userId)))
    .limit(1)
    .then((r) => r[0]);

  if (!search) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const filters = safeJsonParse<SearchFilters>(search.filters, {});

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(sse(event, data));

      try {
        const orchestrator = await createScrapingOrchestrator();

        send("progress", {
          kind: "search-start",
          searchId: search.id,
          searchName: search.name,
          index: 0,
          total: 1,
        });

        const result = await orchestrator.crawlSearch(search.id, filters, {
          onPortalProgress: (portal, found, errors) => {
            send("progress", {
              kind: "portal",
              searchId: search.id,
              searchName: search.name,
              portal,
              found,
              errors,
            });
          },
        });

        send("progress", {
          kind: "search-done",
          searchId: search.id,
          searchName: search.name,
          total: result.total,
          errors: result.errors,
        });

        send("done", { total: result.total, runCount: 1, failed: [] });
      } catch (error) {
        console.error("Run search error:", error);
        send("error", { message: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
