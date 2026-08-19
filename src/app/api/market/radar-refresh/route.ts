import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { refreshMacroSeries } from "@/lib/market/macro";
import { refreshCzsoSeries } from "@/lib/market/czso-radar";
import { readSeries } from "@/lib/market/radar-query";
import type { SeriesPoint } from "@/lib/market/radar-store";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret ? req.headers.get("x-cron-secret") === cronSecret : false;
  if (!isCron) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const macro = await refreshMacroSeries();
    // CPI z DB (může být starší, pokud ČBA chvíli nefunguje) pro dopočet reálných mezd
    const cpi: SeriesPoint[] = await readSeries("cpi_yoy", "cr", 30 * 13);
    const czso = await refreshCzsoSeries(cpi);
    return NextResponse.json({ macro, czso });
  } catch (e) {
    console.error("Radar refresh error:", e);
    return NextResponse.json({ error: "Radar refresh selhal" }, { status: 500 });
  }
}