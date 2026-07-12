import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scrapeUrl } from "@/lib/scraping/url-scraper";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { analyzeListing as aiAnalyzeListing } from "@/lib/ai/analyzer";
import { classifyLocation } from "@/lib/analysis/location";
import { getMarketPriceRange } from "@/lib/scraping/market-price-service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "Chybí URL adresy" }, { status: 400 });
    }
    if (urls.length > 10) {
      return NextResponse.json({ error: "Maximálně 10 URL najednou" }, { status: 400 });
    }

    const results = await Promise.all(
      urls.map(async (url: string) => {
        try {
          const { portal, listing } = await scrapeUrl(url);
          if (!listing.price || listing.price <= 0) {
            return { url, portal, success: false, error: "Nepodařilo se načíst cenu inzerátu" };
          }

          const location = classifyLocation(listing.address, listing.title);
          const dynamicRange = location.city !== "Neznámá"
            ? await getMarketPriceRange(location.city).catch(() => null)
            : null;
          const analysis = analyzeListing(listing, dynamicRange);

          let aiSummary: string | null = null;
          let aiNegotiationTips: string[] | null = null;
          let aiComparableNotes: string | null = null;
          let aiHiddenInfo: string[] | null = null;
          if (process.env.GEMINI_API_KEY) {
            try {
              const aiResult = await aiAnalyzeListing({
                title: listing.title,
                description: listing.description ?? "",
                price: listing.price,
                pricePerSqm: listing.pricePerSqm,
                area: listing.area,
                rooms: listing.rooms,
                address: listing.address,
                condition: listing.condition,
              });
              aiSummary = aiResult.summary;
              aiNegotiationTips = aiResult.negotiationTips;
              aiComparableNotes = aiResult.comparableNotes;
              aiHiddenInfo = aiResult.hiddenInfo;
            } catch {
              aiSummary = "AI analýza není k dispozici. Zkuste to prosím později.";
            }
          }

          return {
            url,
            portal,
            success: true,
            listing: {
              title: listing.title,
              price: listing.price,
              area: listing.area,
              rooms: listing.rooms,
              condition: listing.condition,
              address: listing.address,
              description: listing.description?.slice(0, 500),
              imageUrls: listing.imageUrls.slice(0, 3),
            },
            analysis: {
              pricePerSqm: analysis.pricePerSqm,
              marketPricePerSqmLow: analysis.marketPricePerSqmLow,
              marketPricePerSqmHigh: analysis.marketPricePerSqmHigh,
              undervaluationPct: analysis.undervaluationPct,
              overpricingPct: analysis.overpricingPct,
              investmentScore: analysis.investmentScore,
              verdictLevel: analysis.verdictLevel,
              recommendation: analysis.recommendation,
              verdictSummary: analysis.verdictSummary,
              arv: analysis.arv,
              roi: analysis.roi,
              netProfit: analysis.netProfit,
              targetPurchasePrice: analysis.targetPurchasePrice,
              priceReductionNeeded: analysis.priceReductionNeeded,
              priceReductionPct: analysis.priceReductionPct,
              condition: analysis.condition,
              location: analysis.location,
              buildingType: analysis.buildingType,
              segmentRating: analysis.segmentRating,
              occupancy: analysis.occupancy,
              missingFields: analysis.missingFields,
              redFlags: analysis.redFlags,
              scenarios: analysis.scenarios,
            },
            aiSummary,
            aiNegotiationTips,
            aiComparableNotes,
            aiHiddenInfo,
          };
        } catch (error) {
          return { url, success: false, error: String(error) };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Analyze URL error:", error);
    return NextResponse.json({ error: "Chyba při zpracování požadavku" }, { status: 500 });
  }
}


