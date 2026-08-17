import { auth } from "@/lib/auth";
import { createScrapingOrchestrator } from "@/lib/scraping/orchestrator-setup";
import type { ScrapeProgressEvent } from "@/lib/scraping/orchestrator";

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
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
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
        });

        send("done", {
          total: result.total,
          runCount: result.runCount,
          failed: result.failed,
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
