import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createScrapingOrchestrator } from "@/lib/scraping/orchestrator-setup";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isExternalCron = cronSecret ? req.headers.get("x-cron-secret") === cronSecret : false;
  if (!isExternalCron) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const orchestrator = await createScrapingOrchestrator((portal, found, errors) => {
      console.log(`[scraping] ${portal}: ${found} listings, ${errors.length} errors`);
    });

    await orchestrator.crawlAllScheduled();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scraping trigger error:", error);
    return NextResponse.json(
      { error: "Scraping failed" },
      { status: 500 }
    );
  }
}