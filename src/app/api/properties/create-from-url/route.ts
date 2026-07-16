import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { analyzeListing } from "@/lib/analysis/analyzer";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { url, portalName, title, price, pricePerSqm, area, rooms, floor, condition, buildingType, yearBuilt, address, lat, lng, description, imageUrls, contactName, contactPhone, contactEmail } = body;

    if (!url || !title || !price) {
      return NextResponse.json({ error: "url, title, price required" }, { status: 400 });
    }

    const existing = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.url, url))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return NextResponse.json({ propertyId: existing.id, existed: true });
    }

    const now = ts();
    const propertyId = generateId();

    const rawListing = {
      portalName: portalName ?? "manual",
      title,
      price,
      pricePerSqm: pricePerSqm ?? null,
      area: area ?? null,
      rooms: rooms ?? null,
      floor: floor ?? null,
      condition: condition ?? null,
      buildingType: buildingType ?? null,
      yearBuilt: yearBuilt ?? null,
      address: address ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      description: description ?? null,
      imageUrls: imageUrls ?? [],
      url,
      contactName: contactName ?? null,
      contactPhone: contactPhone ?? null,
      contactEmail: contactEmail ?? null,
      publishedAt: now,
      updatedAt: now,
    };

    const analysis = analyzeListing(rawListing as any);

    await db.insert(properties).values({
      id: propertyId,
      portalId: `${portalName ?? "manual"}_${generateId().slice(0, 8)}`,
      portalName: portalName ?? "manual",
      url,
      title,
      price,
      pricePerSqm: pricePerSqm ?? null,
      area: area ?? null,
      rooms: rooms ?? null,
      floor: floor ?? null,
      condition: condition ?? null,
      buildingType: buildingType ?? null,
      yearBuilt: yearBuilt ?? null,
      address: address ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      contactPhone: contactPhone ?? null,
      contactName: contactName ?? null,
      contactEmail: contactEmail ?? null,
      description: description ?? null,
      imageUrls: JSON.stringify(imageUrls ?? []),
      status: "active",
      firstSeen: now,
      lastSeen: now,
      isActive: 1,
    });

    await db.insert(propertyAnalysis).values({
      id: generateId(),
      propertyId,
      marketValue: analysis.arv,
      undervaluationPct: analysis.undervaluationPct,
      investmentScore: analysis.investmentScore,
      arv: analysis.arv,
      renovationCost: analysis.costs.renovationCost,
      totalCost: analysis.costs.totalCost,
      netProfit: analysis.netProfit,
      roi: analysis.roi,
      annualizedRoi: analysis.annualizedRoi,
      cashOnCash: analysis.cashOnCash,
      breakEvenPrice: analysis.breakEvenPrice,
      recommendation: analysis.recommendation,
      pricePerSqm: analysis.pricePerSqm,
      marketPriceMin: analysis.marketPricePerSqmLow,
      marketPriceMax: analysis.marketPricePerSqmHigh,
      overpricingPct: analysis.overpricingPct,
      locationCategory: analysis.location.category,
      locationCity: analysis.location.city,
      locationDistrict: analysis.location.district,
      segmentRating: analysis.segmentRating,
      occupancy: analysis.occupancy,
      buildingType: analysis.buildingType,
      energyLabel: analysis.energyLabel,
      technicalScore: analysis.technicalScore,
      verdictLevel: analysis.verdictLevel,
      verdictSummary: analysis.verdictSummary,
      redFlagsJson: JSON.stringify(analysis.redFlags),
      costsJson: JSON.stringify(analysis.costs),
      alternativeStrategiesJson: JSON.stringify(analysis.alternativeStrategies),
      rentalYield: analysis.rentalYield,
      aiReport: null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ propertyId, existed: false });
  } catch (error) {
    console.error("Create property error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
