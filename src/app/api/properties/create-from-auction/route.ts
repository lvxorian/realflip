import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { classifyLocation } from "@/lib/analysis/location";
import { calculateAuctionResults } from "@/lib/auctions/auction-flip-costs";
import type { ParsedAuction } from "@/lib/auctions/parse-auction";

export const dynamic = "force-dynamic";

interface AuctionCalcPayload {
  asIsTmv: number;
  td: number;
  tc: number;
  np: number | null;
  arv: number;
  renovationCost: number;
  area: number;
  discount: number;
  targetRoi: number;
  holdingMonths: number;
  sellCommission: boolean;
  sourcingEnabled: boolean;
  sourcingFee: number;
  sourcingFeeIsPct: boolean;
}

interface CreateFromAuctionBody {
  parsed: ParsedAuction;
  calc: AuctionCalcPayload;
  aiSummary?: string | null;
}

/**
 * Uloží analyzovanou dražbu jako nemovitost (portalName = portaldrazeb)
 * spolu s investiční analýzou a dražebními metadaty (auctionDataJson).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as CreateFromAuctionBody;
    const { parsed, calc, aiSummary } = body;

    if (!parsed?.title || !calc || typeof calc.asIsTmv !== "number") {
      return NextResponse.json({ error: "title a calc (asIsTmv) jsou povinné" }, { status: 400 });
    }

    const url = parsed.sourceUrl;
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
      portalName: "portaldrazeb",
      title: parsed.title,
      price: calc.asIsTmv,
      pricePerSqm: calc.area > 0 ? Math.round(calc.asIsTmv / calc.area) : null,
      area: calc.area || parsed.area || null,
      rooms: parsed.rooms ?? null,
      condition: parsed.condition ?? null,
      buildingType: null,
      yearBuilt: null,
      address: parsed.address ?? null,
      lat: null,
      lng: null,
      description: parsed.description ?? null,
      imageUrls: parsed.imageUrls ?? [],
      url,
      contactName: parsed.debtor?.name ?? null,
      contactPhone: null,
      contactEmail: null,
      publishedAt: now,
      updatedAt: now,
    };

    const location = classifyLocation(rawListing.address, rawListing.title);

    const auctionResults = calculateAuctionResults(
      {
        asIsTmv: calc.asIsTmv,
        td: calc.td,
        tc: calc.tc,
        np: calc.np,
        arv: calc.arv,
        renovationCost: calc.renovationCost,
        area: calc.area,
        discount: calc.discount,
        config: {
          sellCommission: calc.sellCommission,
          sourcingEnabled: calc.sourcingEnabled,
          sourcingFee: calc.sourcingFee,
          sourcingFeeIsPct: calc.sourcingFeeIsPct,
          holdingMonths: calc.holdingMonths,
        },
      },
      calc.targetRoi
    );

    const auctionDataJson = JSON.stringify({
      title: parsed.title,
      address: rawListing.address,
      asIsTmv: calc.asIsTmv,
      caseNumber: parsed.caseNumber,
      auctionDate: parsed.auctionDate,
      oc: parsed.appraisalPrice,
      np: parsed.minimumBid,
      td: calc.td,
      tc: calc.tc,
      discount: calc.discount,
      tbp: auctionResults.tbp,
      nco: auctionResults.nco,
      feasible: auctionResults.feasible,
      auctionPayout: auctionResults.auctionPayout,
      negotiationAdvantage: auctionResults.negotiationAdvantage,
      exekutor: parsed.auctioneer,
      debtor: parsed.debtor,
      documents: parsed.documents,
      strategy: auctionResults.strategy,
      targetRoi: calc.targetRoi,
      renovationCost: calc.renovationCost,
      arv: calc.arv,
      holdingMonths: calc.holdingMonths,
      sellCommission: calc.sellCommission,
      sourcingEnabled: calc.sourcingEnabled,
      sourcingFee: calc.sourcingFee,
      sourcingFeeIsPct: calc.sourcingFeeIsPct,
      netProfit: auctionResults.netProfit,
      roi: auctionResults.roi,
      annualizedRoi: auctionResults.annualizedRoi,
      cashOnCash: auctionResults.cashOnCash,
      ceilingPrice: auctionResults.ceilingPrice,
      breakEvenPrice: auctionResults.breakEvenPrice,
      investorProfit: auctionResults.investorProfit,
      dealmakerProfit: auctionResults.dealmakerProfit,
      costs: {
        contingency: auctionResults.costs.contingency,
        sellingCommission: auctionResults.costs.sellingCommission,
        marketingPhoto: auctionResults.costs.marketingPhoto,
        holdingCosts: auctionResults.costs.holdingCosts,
        sourcingFee: auctionResults.costs.sourcingFee,
        incomeTax: auctionResults.costs.incomeTax,
        totalCost: auctionResults.costs.totalCost,
      },
    });

    await db.insert(properties).values({
      id: propertyId,
      portalId: `portaldrazeb_${generateId().slice(0, 8)}`,
      portalName: "portaldrazeb",
      url,
      title: parsed.title,
      price: calc.asIsTmv,
      pricePerSqm: rawListing.pricePerSqm,
      area: rawListing.area,
      rooms: rawListing.rooms,
      condition: rawListing.condition,
      address: rawListing.address,
      description: rawListing.description,
      imageUrls: JSON.stringify(rawListing.imageUrls),
      contactName: rawListing.contactName,
      status: "active",
      firstSeen: now,
      lastSeen: now,
      isActive: 1,
      auctionDataJson,
    });

    const verdictLevel = auctionResults.feasible ? "buy" : "categoricalReject";
    const verdictSummary = auctionResults.feasible
      ? `Výkup realizovatelný – dlužníkovi zůstane ${auctionResults.nco.toLocaleString("cs-CZ")} Kč (TBP ${auctionResults.tbp.toLocaleString("cs-CZ")} Kč − dluhy − náklady).`
      : "Riziko: dluhy přesahují nabídkovou cenu – nutný haircut s věřiteli.";

    await db.insert(propertyAnalysis).values({
      id: generateId(),
      propertyId,
      marketValue: calc.asIsTmv,
      undervaluationPct: 0,
      investmentScore: auctionResults.feasible ? 70 : 25,
      arv: calc.arv,
      renovationCost: calc.renovationCost,
      totalCost: auctionResults.costs.totalCost,
      netProfit: auctionResults.netProfit,
      roi: auctionResults.roi,
      annualizedRoi: auctionResults.annualizedRoi,
      cashOnCash: auctionResults.cashOnCash,
      breakEvenPrice: auctionResults.breakEvenPrice,
      targetPurchasePrice: auctionResults.ceilingPrice,
      recommendation: auctionResults.feasible ? "buy" : "dontBuy",
      pricePerSqm: rawListing.pricePerSqm,
      marketPriceMin: null,
      marketPriceMax: null,
      overpricingPct: 0,
      locationCategory: location.category,
      locationCity: location.city,
      locationDistrict: location.district,
      segmentRating: null,
      occupancy: null,
      buildingType: null,
      energyLabel: null,
      technicalScore: null,
      verdictLevel,
      verdictSummary,
      redFlagsJson: "[]",
      costsJson: JSON.stringify(auctionResults.costs),
      alternativeStrategiesJson: "[]",
      rentalYield: null,
      aiReport: aiSummary ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ propertyId, existed: false });
  } catch (error) {
    console.error("create-from-auction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
