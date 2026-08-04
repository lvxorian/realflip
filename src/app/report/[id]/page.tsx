import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties, propertyAnalysis, priceHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { safeJsonParse } from "@/lib/utils";
import PropertyReport from "@/components/report/property-report";
import AuctionReport, { type AuctionReportData } from "@/components/report/auction-report";

export const dynamic = "force-dynamic";

type AuctionDataRecord = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === "number" && isFinite(v) ? v : 0;
}

function bool(v: unknown): boolean {
  return v === true || v === 1;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function buildAuctionReportData(
  property: typeof properties.$inferSelect,
  auction: AuctionDataRecord
): AuctionReportData {
  const costs = (auction.costs ?? {}) as AuctionDataRecord;
  return {
    title: property.title,
    address: str(auction.address) ?? property.address,
    caseNumber: str(auction.caseNumber),
    auctionDate: str(auction.auctionDate),
    oc: num(auction.oc),
    np: num(auction.np),
    asIsTmv: num(auction.asIsTmv),
    td: num(auction.td),
    tc: num(auction.tc),
    discount: num(auction.discount) || 30,
    renovationCost: num(auction.renovationCost),
    arv: num(auction.arv),
    holdingMonths: num(auction.holdingMonths) || 6,
    sellCommission: bool(auction.sellCommission),
    sourcingEnabled: bool(auction.sourcingEnabled),
    sourcingFee: num(auction.sourcingFee),
    sourcingFeeIsPct: bool(auction.sourcingFeeIsPct),
    targetRoi: num(auction.targetRoi) || 15,
    strategy: auction.strategy === "sourcing-fee" ? "sourcing-fee" : "fifty-fifty",
    tbp: num(auction.tbp),
    nco: num(auction.nco),
    feasible: bool(auction.feasible),
    auctionPayout: num(auction.auctionPayout),
    negotiationAdvantage: num(auction.negotiationAdvantage),
    ceilingPrice: num(auction.ceilingPrice),
    breakEvenPrice: num(auction.breakEvenPrice),
    netProfit: num(auction.netProfit),
    roi: num(auction.roi),
    annualizedRoi: num(auction.annualizedRoi),
    cashOnCash: num(auction.cashOnCash),
    investorProfit: num(auction.investorProfit),
    dealmakerProfit: num(auction.dealmakerProfit),
    costs: {
      contingency: num(costs.contingency),
      sellingCommission: num(costs.sellingCommission),
      marketingPhoto: num(costs.marketingPhoto),
      holdingCosts: num(costs.holdingCosts),
      sourcingFee: num(costs.sourcingFee),
      incomeTax: num(costs.incomeTax),
      totalCost: num(costs.totalCost),
    },
  };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;

  const property = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!property) notFound();

  // Dražba → dedikovaný dražební report (investor / majitel)
  if (property.portalName === "portaldrazeb") {
    const auction = property.auctionDataJson
      ? (safeJsonParse(property.auctionDataJson, null) as AuctionDataRecord | null)
      : null;
    if (auction) {
      const data = buildAuctionReportData(property, auction);
      return (
        <AuctionReport data={data} initialType={type === "owner" ? "owner" : "investor"} />
      );
    }
  }

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
        marketSource: analysis.marketSource,
        marketSampleSize: analysis.marketSampleSize,
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
