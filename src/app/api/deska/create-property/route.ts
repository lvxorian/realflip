import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { deskaDocuments, properties, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deskaDocumentId } = await req.json();
    if (!deskaDocumentId) {
      return NextResponse.json({ error: "deskaDocumentId is required" }, { status: 400 });
    }

    const doc = await db
      .select()
      .from(deskaDocuments)
      .where(eq(deskaDocuments.id, deskaDocumentId))
      .limit(1)
      .then((r) => r[0]);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Create property
    const propertyId = generateId();
    await db.insert(properties).values({
      id: propertyId,
      portalId: "deska",
      portalName: "Uredni deska",
      url: doc.edeskyUrl ?? doc.origUrl ?? `deska-${doc.edeskyId}`,
      title: doc.name,
      price: 0,
      description: doc.textContent ?? doc.name,
      address: doc.address ?? doc.dashboardName ?? null,
      lat: doc.lat ?? null,
      lng: doc.lng ?? null,
      imageUrls: "[]",
      status: "new",
      firstSeen: ts(),
      lastSeen: ts(),
      isActive: 1,
    });

    // Create lead
    const leadId = generateId();
    await db.insert(leads).values({
      id: leadId,
      userId: session.user.id,
      propertyId,
      stage: "new",
      priority: doc.relevance === "HIGH" ? 1 : 0,
      notes: `Imported from deska: ${doc.name} (${doc.dashboardName})`,
      stageEnteredAt: ts(),
      createdAt: ts(),
      updatedAt: ts(),
    });

    // Link back to deska document
    await db
      .update(deskaDocuments)
      .set({ propertyId, leadId })
      .where(eq(deskaDocuments.id, deskaDocumentId));

    return NextResponse.json({ propertyId, leadId });
  } catch (error) {
    console.error("Deska create-property error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
