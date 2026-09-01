import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis, priceHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { classifyLocation } from "@/lib/analysis/location";
import { isSaleListing } from "@/lib/scraping/filters";
import { filterImages } from "@/lib/scraping/types";
import { applyAreaResolution } from "@/lib/scraping/area-resolver";
import { getAnalysisRanges } from "@/lib/scraping/market-price-service";
import { analyzeLocalityAndPersist } from "@/lib/locality";
import { findCrossPortalTarget, mergeCrossPortal } from "@/lib/scraping/property-merge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { url, portalName, title, price, pricePerSqm, area, floorArea, usableArea, rooms, floor, condition, buildingType, yearBuilt, address, lat, lng, description, imageUrls, contactName, contactPhone, contactEmail } = body;

    if (!url || !title || !price) {
      return NextResponse.json({ error: "url, title, price required" }, { status: 400 });
    }

    if (!isSaleListing({ title, address, description, url })) {
      return NextResponse.json(
        { error: "Only sale listings are allowed (poptávky ani nájmy nejsou podporovány)" },
        { status: 400 }
      );
    }

    // centrální gatekeeper — root-rel/placeholder URL nesmí projít do DB bez
    // normalizace (stejná brána jako orchestrator.saveListing)
    const cleanImageUrls = filterImages(Array.isArray(imageUrls) ? imageUrls : [], portalName ?? "manual");

    const existing = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.url, url))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return NextResponse.json({ propertyId: existing.id, existed: true });
    }

    // Stejná nemovitost z jiného portálu → sloučíme místo nového řádku.
    const crossTarget = await findCrossPortalTarget({
      portalName: portalName ?? null,
      url,
      title,
      price: price ?? null,
      address: address ?? null,
      rooms: rooms ?? null,
      area: area ?? null,
      description: description ?? null,
      imageUrls: cleanImageUrls,
      contactPhone: contactPhone ?? null,
      contactName: contactName ?? null,
      contactEmail: contactEmail ?? null,
    });
    if (crossTarget) {
      const propertyId = await mergeCrossPortal(crossTarget, {
        portalName: portalName ?? null,
        url,
        title,
        price: price ?? null,
        address: address ?? null,
        rooms: rooms ?? null,
        area: area ?? null,
        description: description ?? null,
        imageUrls: cleanImageUrls,
        contactPhone: contactPhone ?? null,
        contactName: contactName ?? null,
        contactEmail: contactEmail ?? null,
      });
      return NextResponse.json({ propertyId, existed: true, merged: true });
    }

    const now = ts();
    const propertyId = generateId();

    const rawListing = {
      portalName: portalName ?? "manual",
      title,
      price,
      pricePerSqm: pricePerSqm ?? null,
      area: area ?? null,
      floorArea: floorArea ?? null,
      usableArea: usableArea ?? null,
      rooms: rooms ?? null,
      floor: floor ?? null,
      condition: condition ?? null,
      buildingType: buildingType ?? null,
      yearBuilt: yearBuilt ?? null,
      address: address ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      description: description ?? null,
      imageUrls: cleanImageUrls,
      url,
      contactName: contactName ?? null,
      contactPhone: contactPhone ?? null,
      contactEmail: contactEmail ?? null,
      publishedAt: now,
      updatedAt: now,
    };

    const { resolved: resolvedListing, accessoryArea, flag } = applyAreaResolution(rawListing);
    const resolvedArea = resolvedListing.area;
    const resolvedPricePerSqm = resolvedListing.pricePerSqm;

    const location = classifyLocation(resolvedListing.address, resolvedListing.title);
    // live=false — Tier 3 (až 80 detail fetchů) by blokoval vložení nemovitosti;
    // chybějící cache doplní plánovaný refreshAllMarketData / re-analýza
    const ranges = location.city !== "Neznámá"
      ? await getAnalysisRanges({
          cityKey: location.city,
          lat: lat ?? null,
          lng: lng ?? null,
          condition: condition ?? null,
          buildingType: buildingType ?? null,
          area: resolvedArea ?? null,
          category: location.category,
        }, false).catch(() => ({ dynamicRange: null, arvRange: null }))
      : { dynamicRange: null, arvRange: null };
    const analysis = analyzeListing(resolvedListing as any, ranges.dynamicRange, undefined, location, ranges.arvRange);

    await db.insert(properties).values({
      id: propertyId,
      portalId: `${portalName ?? "manual"}_${generateId().slice(0, 8)}`,
      portalName: portalName ?? "manual",
      url,
      title,
      price,
      pricePerSqm: resolvedPricePerSqm,
      area: resolvedArea,
      floorArea: floorArea ?? null,
      usableArea: usableArea ?? null,
      accessoryArea: accessoryArea ?? null,
      areaFlag: flag ?? null,
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
      imageUrls: JSON.stringify(cleanImageUrls),
      status: "active",
      firstSeen: now,
      lastSeen: now,
      isActive: 1,
    });

    // Initial price record — bez ní je cenový graf v detailu prázdný
    // (orchestrator ho vkládá při saveListing, manuální cesta musela taky).
    await db.insert(priceHistory).values({
      id: generateId(),
      propertyId,
      price,
      recordedAt: now,
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
      targetPurchasePrice: analysis.targetPurchasePrice,
      recommendation: analysis.recommendation,
      pricePerSqm: analysis.pricePerSqm,
      marketPriceMin: analysis.marketPricePerSqmLow,
      marketPriceMax: analysis.marketPricePerSqmHigh,
      arvPricePerSqmHigh: analysis.arvPricePerSqmHigh,
      marketSource: ranges.dynamicRange?.source ?? null,
      marketSampleSize: ranges.dynamicRange?.sampleSize ?? null,
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

    // Lokalitní inteligence (offline-safe, vynechá chybějící dimenze)
    await analyzeLocalityAndPersist({
      propertyId,
      cityKey: analysis.location.city,
      district: analysis.location.district,
      lat: lat ?? null,
      lng: lng ?? null,
      price,
      area: resolvedArea ?? null,
      title,
      address,
      propertyUrl: url ?? null,
      currentInvestmentScore: analysis.investmentScore,
    }).catch(() => null);

    return NextResponse.json({ propertyId, existed: false });
  } catch (error) {
    console.error("Create property error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
