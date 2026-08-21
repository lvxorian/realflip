import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, priceHistory, propertyAnalysis, calculatorPresets } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { getAnalysisRanges } from "@/lib/scraping/market-price-service";
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

    if (body.floor !== undefined && body.floor !== null && (!Number.isInteger(body.floor) || body.floor < 0)) {
      return NextResponse.json({ error: "Invalid floor" }, { status: 400 });
    }

    if (
      body.yearBuilt !== undefined &&
      body.yearBuilt !== null &&
      (!Number.isInteger(body.yearBuilt) || body.yearBuilt < 1800 || body.yearBuilt > 2030)
    ) {
      return NextResponse.json({ error: "Invalid year built" }, { status: 400 });
    }

    const CONDITION_VALUES = ["new", "renovated", "good", "original", "dilapidated"];
    if (body.condition !== undefined && !CONDITION_VALUES.includes(body.condition)) {
      return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
    }

    const BUILDING_TYPE_VALUES = ["brick", "panel", "new", "mixed"];
    if (body.buildingType !== undefined && !BUILDING_TYPE_VALUES.includes(body.buildingType)) {
      return NextResponse.json({ error: "Invalid building type" }, { status: 400 });
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
    const newCondition = body.condition ?? property.condition;
    const newBuildingType = body.buildingType ?? property.buildingType;
    const newFloor = body.floor !== undefined ? body.floor : property.floor;
    const newYearBuilt = body.yearBuilt !== undefined ? body.yearBuilt : property.yearBuilt;
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
        condition: newCondition,
        buildingType: newBuildingType,
        floor: newFloor,
        yearBuilt: newYearBuilt,
        pricePerSqm,
      })
      .where(eq(properties.id, id));

    // Clear calculator preset so the calculator starts fresh from the new analysis
    await db
      .delete(calculatorPresets)
      .where(eq(calculatorPresets.propertyId, id));

    // Re-analyze with corrected area/condition. Při změně stavu načteme čerstvá tržní
    // data (žhavý přepočet — nový stav mění tržní segment, a tím ARV i skóre).
    const listing: RawListing = {
      portalName: (property.portalName ?? "manual") as RawListing["portalName"],
      url: property.url ?? "",
      title: property.title,
      price: property.price,
      pricePerSqm,
      area: newArea,
      rooms: property.rooms ?? null,
      floor: newFloor,
      condition: newCondition,
      buildingType: newBuildingType ?? null,
      yearBuilt: newYearBuilt,
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

    // Základ: uložený tržní rozsah z poslední analýzy (offline fallback)
    let dynamicRange =
      analysis?.marketPriceMin != null && analysis.marketPriceMax != null
        ? {
            low: analysis.marketPriceMin,
            high: analysis.marketPriceMax,
            median: Math.round((analysis.marketPriceMin + analysis.marketPriceMax) / 2),
          }
        : null;

    let arvRange =
      analysis?.arvPricePerSqmHigh != null
        ? {
            low: analysis.arvPricePerSqmHigh,
            high: analysis.arvPricePerSqmHigh,
            median: analysis.arvPricePerSqmHigh,
          }
        : null;

    let marketSource: string | null = analysis?.marketSource ?? null;
    let marketSampleSize: number | null = analysis?.marketSampleSize ?? null;

    // Žhavý přepočet: změna stavu/konstrukce mění tržní segment (a tím i ARV),
    // proto načteme čerstvá tržní data. Při neznámé lokalitě nebo selhání se
    // spoléháme na uložené hodnoty (offline re-analysis).
    if ((body.condition !== undefined || body.buildingType !== undefined) && analysis?.locationCity && analysis.locationCity !== "Neznámá") {
      const live = await getAnalysisRanges({
        cityKey: analysis.locationCity,
        lat: property.lat ?? null,
        lng: property.lng ?? null,
        condition: newCondition,
        buildingType: newBuildingType ?? null,
        area: newArea ?? null,
        category: analysis.locationCategory ?? "stable",
      }).catch(() => null);

      if (live) {
        if (live.dynamicRange) {
          dynamicRange = live.dynamicRange;
          marketSource = live.dynamicRange.source;
          marketSampleSize = live.dynamicRange.sampleSize;
        }
        if (live.arvRange) arvRange = live.arvRange;
      }
    }

    const precomputedLocation =
      analysis?.locationCity
        ? {
            city: analysis.locationCity,
            district: analysis.locationDistrict ?? null,
            category: (analysis.locationCategory ?? "unknown") as "premium" | "stable" | "risky" | "unknown",
            segments: null,
          }
        : null;

    const result = analyzeListing(listing, dynamicRange, undefined, precomputedLocation ?? undefined, arvRange);

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
          targetPurchasePrice: result.targetPurchasePrice,
          recommendation: result.recommendation,
          pricePerSqm: result.pricePerSqm,
          marketPriceMin: result.marketPricePerSqmLow,
          marketPriceMax: result.marketPricePerSqmHigh,
          arvPricePerSqmHigh: result.arvPricePerSqmHigh,
          marketSource,
          marketSampleSize,
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
        arvPricePerSqmHigh: result.arvPricePerSqmHigh,
        marketSource: null,
        marketSampleSize: null,
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
      propertyUrl: property.url ?? null,
      currentInvestmentScore: result.investmentScore,
    }).catch(() => null);

    return NextResponse.json({
      property: {
        ...property,
        area: newArea,
        areaLocked,
        floor: newFloor,
        yearBuilt: newYearBuilt,
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
