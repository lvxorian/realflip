import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, leads, properties, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const contact = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        email: contacts.email,
        type: contacts.type,
        tags: contacts.tags,
        notes: contacts.notes,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contactLeads = await db
      .select({
        leadId: leads.id,
        stage: leads.stage,
        updatedAt: leads.updatedAt,
        propertyId: properties.id,
        propertyTitle: properties.title,
        propertyPrice: properties.price,
        propertyArea: properties.area,
        propertyRooms: properties.rooms,
        propertyAddress: properties.address,
        analysisScore: propertyAnalysis.investmentScore,
      })
      .from(leads)
      .leftJoin(properties, eq(leads.propertyId, properties.id))
      .leftJoin(propertyAnalysis, eq(propertyAnalysis.propertyId, properties.id))
      .where(eq(leads.contactId, id))
      .orderBy(desc(leads.updatedAt));

    return NextResponse.json({ contact, leads: contactLeads });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
