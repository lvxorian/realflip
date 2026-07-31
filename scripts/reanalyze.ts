import { db } from "../src/db";
import { properties, propertyAnalysis } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "../src/lib/utils";
import { analyzeListing } from "../src/lib/analysis/analyzer";
import { classifyLocation } from "../src/lib/analysis/location";
import { getPropertyMarketRange } from "../src/lib/scraping/market-price-service";
import type { RawListing } from "../src/lib/scraping/types";

async function main() {
  console.log("=== RealFlip Re-analysis ===\n");

  const props = await db
    .select()
    .from(properties)
    .where(eq(properties.isActive, 1));

  console.log(`Active properties: ${props.length}\n`);

  let ok = 0;
  let failed = 0;
  const sources: Record<string, number> = {};

  for (const p of props) {
    try {
      const listing: RawListing = {
        portalName: (p.portalName ?? "manual") as RawListing["portalName"],
        url: p.url ?? "",
        title: p.title,
        price: p.price,
        pricePerSqm: p.pricePerSqm ?? null,
        area: p.area ?? null,
        rooms: p.rooms ?? null,
        floor: p.floor ?? null,
        condition: p.condition ?? null,
        buildingType: p.buildingType ?? null,
        yearBuilt: p.yearBuilt ?? null,
        address: p.address ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        contactPhone: null,
        contactName: null,
        contactEmail: null,
        description: p.description ?? null,
        imageUrls: p.imageUrls ? JSON.parse(p.imageUrls) : [],
        publishedAt: p.firstSeen ?? Date.now(),
        updatedAt: p.lastSeen ?? Date.now(),
      };

      const location = classifyLocation(listing.address, listing.title);
      const dynamicRange =
        location.city !== "Neznámá"
          ? await getPropertyMarketRange({
              cityKey: location.city,
              lat: listing.lat,
              lng: listing.lng,
              condition: listing.condition,
              buildingType: listing.buildingType,
              area: listing.area,
              category: location.category,
            }).catch(() => null)
          : null;

      if (dynamicRange) sources[dynamicRange.source] = (sources[dynamicRange.source] ?? 0) + 1;

      const analysis = analyzeListing(listing, dynamicRange, undefined, location);

      const now = ts();
      await db
        .insert(propertyAnalysis)
        .values({
          id: generateId(),
          propertyId: p.id,
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
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: propertyAnalysis.propertyId,
          set: {
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
            updatedAt: now,
          },
        });

      ok++;
    } catch (err) {
      failed++;
      console.error(`  FAILED ${p.id} (${p.title.slice(0, 50)}): ${err}`);
    }
  }

  console.log(`\nRe-analyzed: ${ok}, failed: ${failed}`);
  console.log(`Market sources: ${JSON.stringify(sources)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Re-analysis failed:", e);
  process.exit(1);
});
