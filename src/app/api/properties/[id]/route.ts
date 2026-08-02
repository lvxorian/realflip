import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, priceHistory, propertyAnalysis, calculatorPresets } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { analyzeListing } from "@/lib/analysis/analyzer";
import type { RawListing } from "@/lib/scraping/types";
import { analyzeLocalityAndPersist } from "@/lib/locality";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const history = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.propertyId, id))
      .orderBy(desc(priceHistory.recordedAt));

    const analysis = await db
      .select()
      .from(propertyAnalysis)
      .where(eq(propertyAnalysis.propertyId, id))
      .limit(1)
      .then((r) => r[0]);

    return NextResponse.json({
      property: {
        ...property,
        imageUrls: property.imageUrls ? JSON.parse(property.imageUrls) : [],
      },
      priceHistory: history,
      analysis: analysis || null,
    });
  } catch (error) {
    console.error("Property fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.area !== undefined && (!Number.isFinite(body.area) || body.area <= 0)) {
      return NextResponse.json({ error: "Invalid area" }, { status: 400 });
    }

    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const analysis = await db
      .select()
      .from(propertyAnalysis)
      .where(eq(propertyAnalysis.propertyId, id))
      .limit(1)
      .then((r) => r[0]);

    const now = ts();
    const newArea = body.area ?? property.area;
    const areaLocked = body.area !== undefined ? 1 : 0;
    const pricePerSqm =
      newArea != null && newArea > 0 && property.price > 0
        ? Math.round(property.price / newArea)
        : property.pricePerSqm;

    await db
      .update(properties)
      .set({
        area: newArea,
        areaLocked,
        pricePerSqm,
      })
      .where(eq(properties.id, id));

    // Clear calculator preset so the calculator starts fresh from the new analysis
    await db
      .delete(calculatorPresets)
      .where(eq(calculatorPresets.propertyId, id));

    // Re-analyze with corrected area (offline — reuse stored market range)
    const listing: RawListing = {
      portalName: (property.portalName ?? "manual") as RawListing["portalName"],
      url: property.url ?? "",
      title: property.title,
      price: property.price,
      pricePerSqm,
      area: newArea,
      rooms: property.rooms ?? null,
      floor: property.floor ?? null,
      condition: property.condition ?? null,
      buildingType: property.buildingType ?? null,
      yearBuilt: property.yearBuilt ?? null,
      address: property.address ?? null,
      lat: property.lat ?? null,
      lng: property.lng ?? null,
      contactPhone: null,
      contactName: null,
      contactEmail: null,
      description: property.description ?? null,
      imageUrls: property.imageUrls ? JSON.parse(property.imageUrls) : [],
      publishedAt: property.firstSeen ?? now,
      updatedAt: property.lastSeen ?? now,
    };

    const dynamicRange =
      analysis?.marketPriceMin != null && analysis.marketPriceMax != null
        ? {
            low: analysis.marketPriceMin,
            high: analysis.marketPriceMax,
            median: Math.round((analysis.marketPriceMin + analysis.marketPriceMax) / 2),
          }
        : null;

    const precomputedLocation =
      analysis?.locationCity
        ? {
            city: analysis.locationCity,
            district: analysis.locationDistrict ?? null,
            category: (analysis.locationCategory ?? "unknown") as "premium" | "stable" | "risky" | "unknown",
            segments: null,
          }
        : null;

    const result = analyzeListing(listing, dynamicRange, undefined, precomputedLocation ?? undefined);

    if (analysis) {
      await db
        .update(propertyAnalysis)
        .set({
          marketValue: result.arv,
          undervaluationPct: result.undervaluationPct,
          investmentScore: result.investmentScore,
          arv: result.arv,
          renovationCost: result.costs.renovationCost,
          totalCost: result.costs.totalCost,
          netProfit: result.netProfit,
          roi: result.roi,
          annualizedRoi: result.annualizedRoi,
          cashOnCash: result.cashOnCash,
          breakEvenPrice: result.breakEvenPrice,
          recommendation: result.recommendation,
          pricePerSqm: result.pricePerSqm,
          marketPriceMin: result.marketPricePerSqmLow,
          marketPriceMax: result.marketPricePerSqmHigh,
          overpricingPct: result.overpricingPct,
          locationCategory: result.location.category,
          locationCity: result.location.city,
          locationDistrict: result.location.district,
          segmentRating: result.segmentRating,
          occupancy: result.occupancy,
          buildingType: result.buildingType,
          energyLabel: result.energyLabel,
          technicalScore: result.technicalScore,
          verdictLevel: result.verdictLevel,
          verdictSummary: result.verdictSummary,
          redFlagsJson: JSON.stringify(result.redFlags),
          costsJson: JSON.stringify(result.costs),
          alternativeStrategiesJson: JSON.stringify(result.alternativeStrategies),
          rentalYield: result.rentalYield,
          updatedAt: now,
        })
        .where(eq(propertyAnalysis.propertyId, id));
    } else {
      await db.insert(propertyAnalysis).values({
        id: generateId(),
        propertyId: id,
        marketValue: result.arv,
        undervaluationPct: result.undervaluationPct,
        investmentScore: result.investmentScore,
        arv: result.arv,
        renovationCost: result.costs.renovationCost,
        totalCost: result.costs.totalCost,
        netProfit: result.netProfit,
        roi: result.roi,
        annualizedRoi: result.annualizedRoi,
        cashOnCash: result.cashOnCash,
        breakEvenPrice: result.breakEvenPrice,
        recommendation: result.recommendation,
        pricePerSqm: result.pricePerSqm,
        marketPriceMin: result.marketPricePerSqmLow,
        marketPriceMax: result.marketPricePerSqmHigh,
        overpricingPct: result.overpricingPct,
        locationCategory: result.location.category,
        locationCity: result.location.city,
        locationDistrict: result.location.district,
        segmentRating: result.segmentRating,
        occupancy: result.occupancy,
        buildingType: result.buildingType,
        energyLabel: result.energyLabel,
        technicalScore: result.technicalScore,
        verdictLevel: result.verdictLevel,
        verdictSummary: result.verdictSummary,
        redFlagsJson: JSON.stringify(result.redFlags),
        costsJson: JSON.stringify(result.costs),
        alternativeStrategiesJson: JSON.stringify(result.alternativeStrategies),
        rentalYield: result.rentalYield,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Lokalitní inteligence (mírný vliv na investmentScore)
    await analyzeLocalityAndPersist({
      propertyId: id,
      cityKey: result.location.city,
      district: result.location.district,
      lat: property.lat ?? null,
      lng: property.lng ?? null,
      price: property.price,
      area: newArea ?? null,
      title: property.title,
      address: property.address,
      currentInvestmentScore: result.investmentScore,
    }).catch(() => null);

    return NextResponse.json({
      property: {
        ...property,
        area: newArea,
        areaLocked,
        pricePerSqm,
      },
      analysis: {
        investmentScore: result.investmentScore,
        arv: result.arv,
        netProfit: result.netProfit,
        roi: result.roi,
        verdictLevel: result.verdictLevel,
        pricePerSqm: result.pricePerSqm,
      },
    });
  } catch (error) {
    console.error("Property update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .delete(properties)
      .where(eq(properties.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Property delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
