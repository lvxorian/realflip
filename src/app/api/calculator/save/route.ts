import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { generateId, ts } from "@/lib/utils";
import { analyzeListing } from "@/lib/analysis/analyzer";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, price, pricePerSqm, area, rooms, floor, condition, buildingType, address, city, description, arv, renovationCost, targetRoi, roi, netProfit } = body;

    if (!title || !price || !area) {
      return NextResponse.json({ error: "title, price, area required" }, { status: 400 });
    }

    const now = ts();
    const propertyId = generateId();

    const rawListing: any = {
      portalName: "offline",
      title,
      price,
      pricePerSqm: pricePerSqm ?? (area > 0 ? Math.round(price / area) : null),
      area: area ?? null,
      rooms: rooms ?? null,
      floor: floor ?? null,
      condition: condition ?? null,
      buildingType: buildingType ?? null,
      yearBuilt: null,
      address: address ?? null,
      lat: null,
      lng: null,
      description: description ?? null,
      imageUrls: [],
      url: "",
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      publishedAt: now,
      updatedAt: now,
    };

    const analysis = analyzeListing(rawListing);

    await db.insert(properties).values({
      id: propertyId,
      portalId: `offline_${generateId().slice(0, 8)}`,
      portalName: "offline",
      url: "",
      title,
      price,
      pricePerSqm: rawListing.pricePerSqm,
      area: area ?? null,
      rooms: rooms ?? null,
      floor: floor ?? null,
      condition: condition ?? null,
      buildingType: buildingType ?? null,
      yearBuilt: null,
      address: address ?? null,
      lat: null,
      lng: null,
      contactPhone: null,
      contactName: null,
      contactEmail: null,
      description: description ?? null,
      imageUrls: JSON.stringify([]),
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
      arv: arv ?? analysis.arv,
      renovationCost: renovationCost ?? analysis.costs.renovationCost,
      totalCost: analysis.costs.totalCost,
      netProfit: netProfit ?? analysis.netProfit,
      roi: roi ?? analysis.roi,
      annualizedRoi: analysis.annualizedRoi,
      cashOnCash: analysis.cashOnCash,
      breakEvenPrice: analysis.breakEvenPrice,
      recommendation: analysis.recommendation,
      pricePerSqm: analysis.pricePerSqm,
      marketPriceMin: analysis.marketPricePerSqmLow,
      marketPriceMax: analysis.marketPricePerSqmHigh,
      overpricingPct: analysis.overpricingPct,
      locationCategory: analysis.location.category,
      locationCity: city ?? analysis.location.city,
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

    return NextResponse.json({ propertyId });
  } catch (error) {
    console.error("Calculator save error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
