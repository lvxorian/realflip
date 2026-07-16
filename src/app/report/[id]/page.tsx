import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties, propertyAnalysis, priceHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import PropertyReport from "@/components/report/property-report";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const property = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!property) notFound();

  const analysis = await db
    .select()
    .from(propertyAnalysis)
    .where(eq(propertyAnalysis.propertyId, id))
    .limit(1)
    .then((r) => r[0]);

  const history = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.propertyId, id))
    .orderBy(desc(priceHistory.recordedAt));

  return (
    <PropertyReport
      property={{
        id: property.id,
        title: property.title,
        price: property.price,
        pricePerSqm: property.pricePerSqm,
        area: property.area,
        rooms: property.rooms,
        floor: property.floor,
        condition: property.condition,
        buildingType: property.buildingType,
        yearBuilt: property.yearBuilt,
        address: property.address,
        description: property.description,
        imageUrls: property.imageUrls ?? "[]",
        url: property.url,
        portalName: property.portalName,
        firstSeen: property.firstSeen,
      }}
      analysis={analysis ? {
        id: analysis.id,
        investmentScore: analysis.investmentScore,
        arv: analysis.arv,
        renovationCost: analysis.renovationCost,
        totalCost: analysis.totalCost,
        netProfit: analysis.netProfit,
        roi: analysis.roi,
        annualizedRoi: analysis.annualizedRoi,
        cashOnCash: analysis.cashOnCash,
        breakEvenPrice: analysis.breakEvenPrice,
        recommendation: analysis.recommendation,
        undervaluationPct: analysis.undervaluationPct,
        overpricingPct: analysis.overpricingPct,
        marketPriceMin: analysis.marketPriceMin,
        marketPriceMax: analysis.marketPriceMax,
        verdictLevel: analysis.verdictLevel,
        verdictSummary: analysis.verdictSummary,
        redFlagsJson: analysis.redFlagsJson,
        costsJson: analysis.costsJson,
        locationCity: analysis.locationCity,
        rentalYield: analysis.rentalYield,
      } : null}
      priceHistory={history.map((h) => ({ price: h.price, recordedAt: h.recordedAt }))}
    />
  );
}
