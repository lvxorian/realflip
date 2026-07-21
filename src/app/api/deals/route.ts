import { NextResponse } from "next/server";
import { db } from "@/db";
import { deals, propertyAnalysis } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { propertyId, purchasePrice, renovationBudget } = await request.json();
    if (!propertyId || !purchasePrice) {
      return NextResponse.json({ error: "propertyId and purchasePrice required" }, { status: 400 });
    }

    const [existing, analysis] = await Promise.all([
      db
        .select({ id: deals.id })
        .from(deals)
        .where(eq(deals.propertyId, propertyId))
        .limit(1)
        .then((r) => r[0]),

      db
        .select({ renovationCost: propertyAnalysis.renovationCost })
        .from(propertyAnalysis)
        .where(eq(propertyAnalysis.propertyId, propertyId))
        .limit(1)
        .then((r) => r[0]),
    ]);

    if (existing) {
      return NextResponse.json({ error: "Deal already exists for this property" }, { status: 409 });
    }

    const id = generateId();
    await db.insert(deals).values({
      id,
      propertyId,
      purchasePrice,
      renovationBudget: renovationBudget ?? analysis?.renovationCost ?? 0,
      renovationActual: 0,
      renovationItems: "[]",
      purchaseDate: ts(),
      status: "purchased",
      createdAt: ts(),
      updatedAt: ts(),
    });

    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
