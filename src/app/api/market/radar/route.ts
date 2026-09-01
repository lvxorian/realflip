import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRadarData } from "@/lib/market/radar-query";

const RANGES = ["1q", "1y", "3y", "5y"];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const range = RANGES.includes(url.searchParams.get("range") ?? "") ? url.searchParams.get("range")! : "1y";
  try {
    const data = await getRadarData(range);
    return NextResponse.json(data);
  } catch (e) {
    console.error("Radar data error:", e);
    return NextResponse.json({ error: "Radar data selhala" }, { status: 500 });
  }
}
