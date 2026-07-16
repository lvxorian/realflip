import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, contacts, properties, propertyAnalysis } from "@/db/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: leads.id,
        stage: leads.stage,
        notes: leads.notes,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        propertyTitle: properties.title,
        propertyPrice: properties.price,
        propertyPricePerSqm: properties.pricePerSqm,
        propertyArea: properties.area,
        propertyRooms: properties.rooms,
        propertyAddress: properties.address,
        propertyCondition: properties.condition,
        analysisScore: propertyAnalysis.investmentScore,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(properties, eq(leads.propertyId, properties.id))
      .leftJoin(propertyAnalysis, eq(propertyAnalysis.propertyId, properties.id))
      .where(and(eq(leads.userId, session.user.id), isNotNull(leads.contactId), eq(leads.stage, "new")))
      .orderBy(desc(leads.priority), desc(leads.createdAt));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
