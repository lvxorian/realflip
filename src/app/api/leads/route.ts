import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, contacts, properties, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/utils";

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
        assignedTo: leads.assignedTo,
        stageData: leads.stageData,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        propertyId: properties.id,
        propertyTitle: properties.title,
        propertyPrice: properties.price,
        propertyArea: properties.area,
        propertyRooms: properties.rooms,
        propertyAddress: properties.address,
        propertyCondition: properties.condition,
        propertyBuildingType: properties.buildingType,
        propertyYearBuilt: properties.yearBuilt,
        propertyPortalName: properties.portalName,
        propertyUrl: properties.url,
        propertyContactName: properties.contactName,
        propertyContactPhone: properties.contactPhone,
        propertyContactEmail: properties.contactEmail,
        propertyImageUrls: properties.imageUrls,
        contactId: contacts.id,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        contactEmail: contacts.email,
        analysisScore: propertyAnalysis.investmentScore,
        analysisArv: propertyAnalysis.arv,
        analysisTargetPurchasePrice: propertyAnalysis.targetPurchasePrice,
      })
      .from(leads)
      .where(eq(leads.userId, session.user.id))
      .leftJoin(properties, eq(leads.propertyId, properties.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(propertyAnalysis, eq(propertyAnalysis.propertyId, properties.id))
      .orderBy(desc(leads.updatedAt));

    const normalized = rows.map((row) => {
      const rawStageData = row.stageData;
      const stageData =
        rawStageData != null && typeof rawStageData === "object"
          ? (rawStageData as Record<string, unknown>)
          : safeJsonParse<Record<string, unknown>>(
              typeof rawStageData === "string" ? rawStageData : null,
              {}
            );
      return {
        ...row,
        stageData,
        propertyPricePerSqm:
          row.propertyPrice != null && row.propertyArea != null && row.propertyArea > 0
            ? Math.round(row.propertyPrice / row.propertyArea)
            : null,
        contactName: row.propertyContactName ?? row.contactName,
        contactPhone: row.propertyContactPhone ?? row.contactPhone,
        contactEmail: row.propertyContactEmail ?? row.contactEmail,
        propertyImageUrl: safeJsonParse<string[]>(row.propertyImageUrls, [])[0] ?? null,
        createdAt: row.createdAt != null ? Number(row.createdAt) : null,
        updatedAt: row.updatedAt != null ? Number(row.updatedAt) : null,
      };
    });

    return NextResponse.json(normalized);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
