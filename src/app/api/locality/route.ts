import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLocalityForProperty, type LocalitySummary } from "@/lib/locality";

export const dynamic = "force-dynamic";

/**
 * Batch lokality: jedno volání místo N sekvenčních /api/locality/{city}.
 * `?cities=praha,brno,ostrava` → results ve stejném pořadí.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const citiesParam = url.searchParams.get("cities") ?? "";
    const cities = [...new Set(citiesParam.split(",").map((c) => c.trim()).filter((c) => c && c !== "Neznámá" && c !== "unknown"))];

    const results = await Promise.all(
      cities.map(async (cityKey) => {
        const summary = await getLocalityForProperty({ cityKey, district: null, lat: null, lng: null });
        return { cityKey, locality: summary as LocalitySummary | null };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Locality batch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
