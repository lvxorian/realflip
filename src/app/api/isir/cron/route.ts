import { NextResponse } from "next/server";
import { runIsirPoll } from "@/lib/isir/run-poll";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIsirPoll();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ISIR] Cron error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}