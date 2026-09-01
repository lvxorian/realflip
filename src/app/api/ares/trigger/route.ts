import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runAresPoll } from "@/lib/ares/run-poll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual trigger — runs the ARES scan in-process (same work as the cron)
// so the client never needs CRON_SECRET and no self-fetch is required.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAresPoll();
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("ARES manual scan error:", msg);
    return NextResponse.json({ error: `Scan error: ${msg}` }, { status: 500 });
  }
}