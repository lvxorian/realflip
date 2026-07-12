import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scrapeUrl } from "@/lib/scraping/url-scraper";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { analyzeListing as aiAnalyzeListing } from "@/lib/ai/analyzer";

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

          const analysis = analyzeListing(listing);

          let aiReport: string | null = null;
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
              aiReport = generateReportMarkdown(listing, analysis, aiResult);
            } catch {
              aiReport = "AI analýza není k dispozici. Zkuste to prosím později.";
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
            aiReport,
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

function formatPrice(n: number): string {
  return n.toLocaleString("cs-CZ") + " Kč";
}

function generateReportMarkdown(
  listing: any,
  analysis: any,
  aiResult: any
): string {
  const verdictEmoji: Record<string, string> = {
    strongBuy: "🟢", buy: "🟢", consider: "🟡", dontBuy: "🔴", categoricalReject: "⛔",
  };

  const verdictLabel: Record<string, string> = {
    strongBuy: "Silný kandidát ke koupi",
    buy: "Doporučeno ke koupi",
    consider: "Zvážit s opatrností",
    dontBuy: "Nedoporučeno",
    categoricalReject: "Kategorické odmítnutí",
  };

  const lines: string[] = [];
  lines.push(`## ${verdictEmoji[analysis.verdictLevel] ?? "❓"} ${verdictLabel[analysis.verdictLevel] ?? analysis.verdictLevel}`);
  lines.push("");
  lines.push(`**${listing.title}**`);
  lines.push(`📍 ${listing.address ?? "neuvedeno"} | ${listing.area ? listing.area + " m²" : "plocha neuvedena"} | ${listing.rooms ?? "?"}`);
  lines.push(`💰 **Cena:** ${formatPrice(listing.price)} | **ARV:** ${formatPrice(analysis.arv)}`);
  lines.push("");
  lines.push("### 📊 Klíčové metriky");
  lines.push(`| Metrika | Hodnota |`);
  lines.push(`|---------|---------|`);
  lines.push(`| Cena za m² | ${analysis.pricePerSqm ? formatPrice(analysis.pricePerSqm) + "/m²" : "neuvedeno"} |`);
  lines.push(`| Tržní rozmezí | ${formatPrice(analysis.marketPricePerSqmLow)} – ${formatPrice(analysis.marketPricePerSqmHigh)} /m² |`);
  lines.push(`| Podhodnocení | ${analysis.undervaluationPct > 0 ? analysis.undervaluationPct.toFixed(1) + "% ✅" : "—"} |`);
  lines.push(`| Nadhodnocení | ${analysis.overpricingPct > 0 ? analysis.overpricingPct.toFixed(1) + "% ⚠️" : "—"} |`);
  lines.push(`| Investiční skóre | ${analysis.investmentScore}/100 |`);
  lines.push(`| Konzervativní ROI | ${analysis.roi.toFixed(1)}% |`);
  lines.push(`| Čistý zisk | ${formatPrice(analysis.netProfit)} |`);
  lines.push(`| Cílová nákupní cena | ${formatPrice(analysis.targetPurchasePrice)} |`);
  lines.push(`| Nutné snížení | ${formatPrice(analysis.priceReductionNeeded)} (${analysis.priceReductionPct}%) |`);
  lines.push(`| Stav | ${analysis.condition ?? "nezjištěn"} |`);
  lines.push(`| Lokalita | ${analysis.location?.city ?? "?"} (${analysis.location?.category ?? "?"}) |`);
  lines.push(`| Typ budovy | ${analysis.buildingType ?? "?"} |`);

  if (analysis.scenarios) {
    lines.push("");
    lines.push("### 📈 Scénáře");
    lines.push(`| Scénář | Renovace | ARV | Celk. náklady | Zisk | ROI |`);
    lines.push(`|--------|----------|-----|--------------|------|-----|`);
    for (const key of ["optimistic", "conservative", "pessimistic"]) {
      const s = analysis.scenarios[key];
      if (s) {
        lines.push(`| ${s.label} | ${formatPrice(s.renovationCost)} | ${formatPrice(s.arv)} | ${formatPrice(s.totalCost)} | ${formatPrice(s.netProfit)} | ${s.roi}% |`);
      }
    }
  }

  if (aiResult?.summary) {
    lines.push("");
    lines.push("### 🤖 AI Hodnocení");
    lines.push(aiResult.summary);
  }

  if (aiResult?.negotiationTips?.length > 0) {
    lines.push("");
    lines.push("### 💡 Vyjednávací tipy");
    for (const tip of aiResult.negotiationTips) {
      lines.push(`- ${tip}`);
    }
  }

  if (analysis.redFlags?.length > 0) {
    lines.push("");
    lines.push("### ⚠️ Varovné signály");
    for (const rf of analysis.redFlags) {
      lines.push(`- **${rf.type}**: ${rf.description}`);
    }
  }

  if (aiResult?.comparableNotes) {
    lines.push("");
    lines.push("### 📋 Srovnání s trhem");
    lines.push(aiResult.comparableNotes);
  }

  return lines.join("\n");
}
