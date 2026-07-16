import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq, and, ne, gte } from "drizzle-orm";
import { filterImages } from "@/lib/scraping/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { area, address, price, excludeUrl, city } = await req.json();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: properties.id,
        title: properties.title,
        price: properties.price,
        area: properties.area,
        rooms: properties.rooms,
        address: properties.address,
        imageUrls: properties.imageUrls,
        url: properties.url,
        condition: properties.condition,
        buildingType: properties.buildingType,
        lat: properties.lat,
        lng: properties.lng,
        analysisScore: propertyAnalysis.investmentScore,
        analysisArv: propertyAnalysis.arv,
      })
      .from(properties)
      .leftJoin(propertyAnalysis, eq(properties.id, propertyAnalysis.propertyId))
      .where(and(
        eq(properties.isActive, true),
        ne(properties.url, excludeUrl ?? ""),
        gte(properties.lastSeen, thirtyDaysAgo),
      ))
      .limit(50);

    let comps = rows;

    // 1) Filter by city (from analysis location)
    if (city) {
      const cityLower = city.toLowerCase().replace(/_/g, " ");
      const byCity = comps.filter((p) =>
        (p.address ?? "").toLowerCase().includes(cityLower)
      );
      if (byCity.length >= 2) comps = byCity;
    }

    // 2) Filter by area ±30 %
    if (area && area > 0) {
      const areaRange = area * 0.3;
      const byArea = comps.filter(
        (p) => p.area && Math.abs(p.area - area) <= areaRange
      );
      if (byArea.length >= 2) comps = byArea;
    }

    // 3) Filter by price ±50 %
    if (price) {
      const priceMin = price * 0.5;
      const priceMax = price * 2;
      const byPrice = comps.filter(
        (p) => p.price >= priceMin && p.price <= priceMax
      );
      if (byPrice.length >= 2) comps = byPrice;
    }

    // Stats
    const prices = comps.map((p) => p.price).filter((p): p is number => p > 0);
    const areas = comps.map((p) => p.area).filter((a): a is number => a !== null && a > 0);
    const pricePerSqms = prices
      .map((p, i) => (areas[i] ? Math.round(p / areas[i]) : null))
      .filter((p): p is number => p !== null);

    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    const p25 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.25)] : 0;
    const p75 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.75)] : 0;

    const sortedPerSqm = [...pricePerSqms].sort((a, b) => a - b);
    const medianPerSqm = sortedPerSqm.length > 0
      ? sortedPerSqm.length % 2 === 0
        ? (sortedPerSqm[sortedPerSqm.length / 2 - 1] + sortedPerSqm[sortedPerSqm.length / 2]) / 2
        : sortedPerSqm[Math.floor(sortedPerSqm.length / 2)]
      : 0;

    const mappedComps = comps.slice(0, 20).map((p) => {
      let imageUrl: string | null = null;
      if (p.imageUrls) {
        try {
          const parsed = JSON.parse(p.imageUrls as string);
          const filtered = filterImages(Array.isArray(parsed) ? parsed : []);
          imageUrl = filtered[0] ?? null;
        } catch { imageUrl = null; }
      }
      return {
        id: p.id,
        title: p.title,
        price: p.price,
        area: p.area,
        rooms: p.rooms,
        address: p.address,
        condition: p.condition,
        buildingType: p.buildingType,
        imageUrl,
        url: p.url,
        score: p.analysisScore,
        arv: p.analysisArv,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        count: comps.length,
        medianPrice: Math.round(median),
        medianPricePerSqm: Math.round(medianPerSqm),
        p25: Math.round(p25),
        p75: Math.round(p75),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      },
      comps: mappedComps,
    });
  } catch (error) {
    console.error("Comps API error:", error);
    return NextResponse.json(
      { success: false, error: "Nepodařilo se načíst srovnatelné nemovitosti" },
      { status: 500 }
    );
  }
}
