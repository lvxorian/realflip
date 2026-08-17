import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { analyzeListing } from "@/lib/ai/analyzer";

/**
 * On-demand AI hodnocení nemovitosti (analýza inzerátu přes Gemini).
 *
 * AI analýza se záměrně NEGENERUJE při crawlu (hromadné hledání by okamžitě
 * vyčerpalo free tier kvótu Gemini — 20 requestů/den) — generuje se až
 * tlačítkem v detailu nemovitosti, když uživatel inzerát skutečně otevře.
 * Výsledek se uloží do property_analysis.ai_report a zobrazí jako karta
 * „AI Hodnocení".
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: propertyId } = await params;

    const property = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1)
      .then((r) => r[0]);

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const result = await analyzeListing({
      title: property.title,
      description: property.description ?? "",
      price: property.price,
      pricePerSqm: property.pricePerSqm ?? null,
      area: property.area ?? null,
      rooms: property.rooms ?? null,
      address: property.address ?? null,
      condition: property.condition ?? null,
    });

    const aiReport = JSON.stringify(result);
    const now = ts();

    const existing = await db
      .select({ id: propertyAnalysis.id })
      .from(propertyAnalysis)
      .where(eq(propertyAnalysis.propertyId, propertyId))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(propertyAnalysis)
        .set({ aiReport, updatedAt: now })
        .where(eq(propertyAnalysis.propertyId, propertyId));
    } else {
      // Kdyby analýza chyběla (např. ručně vložená nemovitost), vytvoříme
      // záznam jen s povinnými poli — statistická analýza se doplní příště.
      await db.insert(propertyAnalysis).values({
        id: generateId(),
        propertyId,
        marketValue: property.price,
        undervaluationPct: 0,
        investmentScore: 0,
        aiReport,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
