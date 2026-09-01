import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { createScrapingOrchestrator } from "@/lib/scraping/orchestrator-setup";
import { refreshAllMarketData } from "@/lib/scraping/market-price-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron posílá GET s `Authorization: Bearer ${CRON_SECRET}`;
 * GH Actions / ruční volání mohou použít `x-cron-secret`; UI používá session.
 * Bez nastaveného CRON_SECRET je strojová cesta zamčená (fail-closed).
 */
async function isAuthorized(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const bearer = req.headers.get("authorization");
    const header = req.headers.get("x-cron-secret");
    if (bearer === `Bearer ${cronSecret}` || header === cronSecret) return true;
  }
  const session = await auth();
  return !!session?.user?.id;
}

async function runScraping(req: Request): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orchestrator = await createScrapingOrchestrator((portal, found, errors) => {
      console.log(`[scraping] ${portal}: ${found} listings, ${errors.length} errors`);
    });

    await orchestrator.crawlAllScheduled();

    // Market backfill (Tier-3 live) běží po odeslání odpovědi přes after() =
    // waitUntil na Vercelu — nesuseká se po návratu response jako fire-and-forget.
    after(() => refreshAllMarketData().catch(() => {}));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scraping trigger error:", error);
    return NextResponse.json({ error: "Scraping failed" }, { status: 500 });
  }
}

// Vercel Cron (vercel.json, 0 6 * * *) volá GET.
export async function GET(req: Request) {
  return runScraping(req);
}

// Ruční spuštění z UI (session) nebo GH Actions (x-cron-secret).
export async function POST(req: Request) {
  return runScraping(req);
}
