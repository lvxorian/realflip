import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, priceHistory, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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
