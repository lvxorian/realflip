import { NextResponse } from "next/server";
import { runAresPoll } from "@/lib/ares/run-poll";
import { hasCronBearer } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!hasCronBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAresPoll();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ARES] Cron error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}