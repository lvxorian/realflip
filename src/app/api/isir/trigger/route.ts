import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runIsirPoll } from "@/lib/isir/run-poll";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Manual trigger — runs the ISIR scan in-process (same work as the cron)
// so the client never needs CRON_SECRET and no self-fetch is required.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIsirPoll();
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("ISIR manual scan error:", msg);
    return NextResponse.json({ error: `Scan error: ${msg}` }, { status: 500 });
  }
}