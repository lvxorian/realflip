import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { leads, contacts, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

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

    const existing = await db
      .select()
      .from(leads)
      .where(and(eq(leads.propertyId, propertyId), eq(leads.userId, session.user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return NextResponse.json({ leadId: existing.id, contactId: existing.contactId });
    }

    const now = ts();

    let contactId: string | null = null;
    if (property.contactName) {
      const existingContact = property.contactPhone
        ? await db
            .select()
            .from(contacts)
            .where(eq(contacts.phone, property.contactPhone))
            .limit(1)
            .then((r) => r[0])
        : null;

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        contactId = generateId();
        await db.insert(contacts).values({
          id: contactId,
          name: property.contactName,
          phone: property.contactPhone,
          email: property.contactEmail,
          type: "owner",
          tags: JSON.stringify(["z inzerátu"]),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const leadId = generateId();
    await db.insert(leads).values({
      id: leadId,
      userId: session.user.id,
      propertyId,
      contactId,
      stage: "new",
      priority: 0,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ leadId, contactId });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
