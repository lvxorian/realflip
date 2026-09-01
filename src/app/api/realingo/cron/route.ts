import { NextResponse } from "next/server";
import { syncRealingo } from "@/lib/realingo/sync";
import { hasCronBearer } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!hasCronBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncRealingo();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Realingo] Cron error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
