import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { PropertiesExplorer, type PropertyListItem } from "@/components/ui/properties-explorer";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const rows = await db
    .select({
      id: properties.id,
      title: properties.title,
      price: properties.price,
      pricePerSqm: properties.pricePerSqm,
      area: properties.area,
      rooms: properties.rooms,
      address: properties.address,
      imageUrls: properties.imageUrls,
      firstSeen: properties.firstSeen,
      portalName: properties.portalName,
      condition: properties.condition,
      score: propertyAnalysis.investmentScore,
      recommendation: propertyAnalysis.recommendation,
      locationCity: propertyAnalysis.locationCity,
      verdictLevel: propertyAnalysis.verdictLevel,
      roi: propertyAnalysis.roi,
      undervaluationPct: propertyAnalysis.undervaluationPct,
      overpricingPct: propertyAnalysis.overpricingPct,
      marketPriceMax: propertyAnalysis.marketPriceMax,
    })
    .from(properties)
    .leftJoin(propertyAnalysis, eq(propertyAnalysis.propertyId, properties.id))
    .where(eq(properties.isActive, true))
    .orderBy(desc(properties.firstSeen));

  const now = Date.now();
  const items: PropertyListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    pricePerSqm: r.pricePerSqm,
    area: r.area,
    rooms: r.rooms,
    address: r.address,
    portalName: r.portalName,
    condition: r.condition,
    locationCity: r.locationCity,
    verdictLevel: r.verdictLevel,
    roi: r.roi,
    score: r.score,
    recommendation: r.recommendation,
    undervaluationPct: r.undervaluationPct,
    overpricingPct: r.overpricingPct,
    marketPriceMax: r.marketPriceMax,
    daysOnMarket: Math.max(
      0,
      Math.floor((now - new Date(r.firstSeen).getTime()) / 86400000)
    ),
    imageUrls: r.imageUrls ? JSON.parse(r.imageUrls) : [],
  }));

  return <PropertiesExplorer items={items} />;
}
