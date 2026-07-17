import { NextResponse } from "next/server";
import { getMarketPriceRange } from "@/lib/scraping/market-price-service";
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

    const range = await getMarketPriceRange(city);
    return NextResponse.json(range ?? null);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
