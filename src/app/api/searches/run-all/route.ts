import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createScrapingOrchestrator } from "@/lib/scraping/orchestrator-setup";

export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orchestrator = await createScrapingOrchestrator();
    const result = await orchestrator.crawlAllForUser(userId);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Run-all searches error:", error);
    return NextResponse.json({ error: "Hromadné hledání selhalo" }, { status: 500 });
  }
}