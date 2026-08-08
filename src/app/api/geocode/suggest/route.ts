import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { suggestAddresses } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * Autocomplete adres pro Odhad (Nominatim search) — vrací návrhy s GPS
 * a hinty na čtvrť, aby se ward v cenové mapě namatchoval přesně.
 * GET /api/geocode/suggest?q=Travná&cityKey=praha
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const cityKey = searchParams.get("cityKey") || undefined;
    if (q.length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    // Throttling Nominatim běží uvnitř suggestAddresses (jen při cache miss) —
    // client debounce + server throttling + 6h cache; cachované dotazy odpovídají okamžitě.
    const suggestions = await suggestAddresses(q, cityKey);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Geocode suggest error:", error);
    // selhání nesmí rozbít formulář — prázdné návrhy, ruční zadání zůstává funkční
    return NextResponse.json({ suggestions: [] });
  }
}
