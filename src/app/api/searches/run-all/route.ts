import { auth } from "@/lib/auth";
import { createScrapingOrchestrator } from "@/lib/scraping/orchestrator-setup";
import type { ScrapeProgressEvent } from "@/lib/scraping/orchestrator";
import { PORTAL_CONFIGS, type PortalName } from "@/lib/scraping/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Hromadné hledání streamované jako SSE — UI vidí živý průběh per hledání
 * i per portál místo tichého čekání na jednorázovou odpověď (která na
 * Vercelu při 60s limitu padala timeoutem). Průběžné výsledky se ukládají
 * do DB průběžně, takže i při přerušení streamu zůstávají zachovány.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Auto-pokračování: klient po přerušení (Vercel limit 60 s) pošle seznam
  // hledání, která už proběhla — spustí se jen zbývající a zbytek se dojede sám.
  // Navíc pošle portály dokončené pro každé hledání, aby se nepřelezaly znovu.
  let skipSearchIds: string[] = [];
  let skipPortals: Record<string, PortalName[]> = {};
  try {
    const body = await req.json();
    if (Array.isArray(body?.skipSearchIds)) {
      skipSearchIds = body.skipSearchIds.filter((x: unknown) => typeof x === "string");
    }
    if (body?.skipPortals && typeof body.skipPortals === "object") {
      skipPortals = {};
      for (const [searchId, portals] of Object.entries(body.skipPortals as Record<string, unknown>)) {
        if (Array.isArray(portals)) {
          skipPortals[searchId] = portals.filter(
            (x): x is PortalName => typeof x === "string" && x in PORTAL_CONFIGS
          );
        }
      }
    }
  } catch {
    // Bez body (první spuštění) — spustí se všechna hledání.
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(sse(event, data));

      try {
        const orchestrator = await createScrapingOrchestrator();

        // AI hodnocení se při crawlu negeneruje (kvóta Gemini free tieru je
        // omezená) — generuje se on-demand tlačítkem v detailu nemovitosti.
        const result = await orchestrator.crawlAllForUser(userId, {
          onProgress: (event: ScrapeProgressEvent) => send("progress", event),
          skipSearchIds,
          skipPortals,
        });

        send("done", {
          total: result.total,
          runCount: result.runCount,
          failed: result.failed,
          incomplete: result.incomplete,
        });
      } catch (error) {
        console.error("Run-all searches error:", error);
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
