import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, contacts, properties, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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
        priority: leads.priority,
        notes: leads.notes,
        updatedAt: leads.updatedAt,
        propertyId: properties.id,
        propertyTitle: properties.title,
        propertyPrice: properties.price,
        propertyArea: properties.area,
        propertyRooms: properties.rooms,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        analysisScore: propertyAnalysis.investmentScore,
      })
      .from(leads)
      .leftJoin(properties, eq(leads.propertyId, properties.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(propertyAnalysis, eq(propertyAnalysis.propertyId, properties.id))
      .orderBy(desc(leads.updatedAt));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
