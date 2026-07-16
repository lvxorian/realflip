import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, deals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      portalName,
      url,
      title,
      price,
      pricePerSqm,
      area,
      rooms,
      floor,
      condition,
      buildingType,
      yearBuilt,
      address,
      lat,
      lng,
      description,
      imageUrls,
      arv,
      renovationCost,
      targetPrice,
      roi,
      netProfit,
      notes,
      status,
    } = body;

    const now = new Date();

    const existingProperty = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.url, url))
      .limit(1)
      .then((r) => r[0]);

    let propertyId: string;

    if (existingProperty) {
      propertyId = existingProperty.id;
      await db
        .update(properties)
        .set({
          price,
          pricePerSqm,
          area,
          rooms,
          floor,
          condition,
          buildingType,
          yearBuilt,
          address,
          lat,
          lng,
          description,
          imageUrls: JSON.stringify(imageUrls ?? []),
          lastSeen: now,
          isActive: 1,
        })
        .where(eq(properties.id, propertyId));
    } else {
      propertyId = generateId();
      const portalId = `${portalName ?? "manual"}_${generateId().slice(0, 8)}`;
      await db.insert(properties).values({
        id: propertyId,
        portalId,
        portalName: portalName ?? "manual",
        url,
        title,
        price,
        pricePerSqm,
        area,
        rooms,
        floor,
        condition,
        buildingType,
        yearBuilt,
        address,
        lat,
        lng,
        description,
        imageUrls: JSON.stringify(imageUrls ?? []),
        status: "active",
        firstSeen: now,
        lastSeen: now,
        isActive: 1,
      });
    }

    const existingDeal = await db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.propertyId, propertyId))
      .limit(1)
      .then((r) => r[0]);

    if (existingDeal) {
      await db
        .update(deals)
        .set({
          purchasePrice: price,
          renovationBudget: renovationCost ?? null,
          status: status ?? "new",
          notes: notes ?? null,
          updatedAt: now,
        })
        .where(eq(deals.id, existingDeal.id));

      return NextResponse.json({ success: true, dealId: existingDeal.id, propertyId });
    }

    const dealId = generateId();
    await db.insert(deals).values({
      id: dealId,
      propertyId,
      purchasePrice: price,
      purchaseDate: now,
      renovationBudget: renovationCost ?? null,
      status: status ?? "new",
      notes: notes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, dealId, propertyId });
  } catch (error) {
    console.error("Save deal error:", error);
    return NextResponse.json(
      { success: false, error: "Nepodařilo se uložit deal" },
      { status: 500 }
    );
  }
}
