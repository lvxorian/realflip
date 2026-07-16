import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq, and, between, or, like, ne, gte, lte, sql } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { area, rooms, address, price, lat, lng, excludeUrl } = await req.json();

    const similar: any[] = [];

    const base = db
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
        analysisRoi: propertyAnalysis.roi,
        analysisArv: propertyAnalysis.arv,
      })
      .from(properties)
      .leftJoin(propertyAnalysis, eq(properties.id, propertyAnalysis.propertyId))
      .where(and(
        eq(properties.isActive, true),
        ne(properties.url, excludeUrl ?? ""),
      ))
      .limit(50);

    const comps = await base;

    let priceFiltered = comps;
    if (price) {
      const priceRangeMin = price * 0.5;
      const priceRangeMax = price * 2;
      priceFiltered = comps.filter((p) => p.price >= priceRangeMin && p.price <= priceRangeMax);
    }

    let areaFiltered = priceFiltered;
    if (area && area > 0) {
      const areaRange = area * 0.3;
      areaFiltered = priceFiltered.filter(
        (p) => p.area && Math.abs(p.area - area) <= areaRange
      );
    }

    let locationFiltered = areaFiltered;
    if (address) {
      const normalized = address.toLowerCase().slice(0, 30);
      locationFiltered = areaFiltered.filter(
        (p) => p.address?.toLowerCase().includes(normalized) || normalized.includes(p.address?.toLowerCase().slice(0, 30) ?? "")
      );
    }

    const finalComps = locationFiltered.length >= 3 ? locationFiltered : areaFiltered.length >= 3 ? areaFiltered : priceFiltered.length >= 3 ? priceFiltered : comps;

    const prices = finalComps.map((p) => p.price).filter((p): p is number => p > 0);
    const areas = finalComps.map((p) => p.area).filter((a): a is number => a !== null && a > 0);
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

    return NextResponse.json({
      success: true,
      stats: {
        count: finalComps.length,
        medianPrice: Math.round(median),
        medianPricePerSqm: Math.round(medianPerSqm),
        p25: Math.round(p25),
        p75: Math.round(p75),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      },
      comps: finalComps.slice(0, 20).map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        area: p.area,
        rooms: p.rooms,
        address: p.address,
        condition: p.condition,
        buildingType: p.buildingType,
        imageUrl: p.imageUrls ? (JSON.parse(p.imageUrls as string)?.[0] ?? null) : null,
        url: p.url,
        score: p.analysisScore,
        arv: p.analysisArv,
      })),
    });
  } catch (error) {
    console.error("Comps API error:", error);
    return NextResponse.json(
      { success: false, error: "Nepodařilo se načíst srovnatelné nemovitosti" },
      { status: 500 }
    );
  }
}
