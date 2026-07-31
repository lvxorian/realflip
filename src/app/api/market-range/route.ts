import { NextResponse } from "next/server";
import { getPropertyMarketRange } from "@/lib/scraping/market-price-service";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");
    if (!city) {
      return NextResponse.json({ error: "City required" }, { status: 400 });
    }

    const lat = parseFloat(searchParams.get("lat") ?? "");
    const lng = parseFloat(searchParams.get("lng") ?? "");

    const range = await getPropertyMarketRange({
      cityKey: city,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      condition: searchParams.get("condition"),
      buildingType: searchParams.get("buildingType"),
      area: parseFloat(searchParams.get("area") ?? "") || null,
      category: searchParams.get("category"),
    });
    return NextResponse.json(range ?? null);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
