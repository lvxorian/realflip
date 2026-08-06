import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { investors, leads, notifications, properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getInvestorSession } from "@/lib/investor-session";
import { PORTAL_STAGE } from "@/lib/investor-portal";
import { touchInvestorActivity } from "@/lib/investor-activity-actions";
import { generateId, ts } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getInvestorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await touchInvestorActivity(session.sub);

  let body: { id?: string; action?: "reserve" | "cancel" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const leadId = typeof body.id === "string" ? body.id : "";
  const action = body.action === "cancel" ? "cancel" : "reserve";
  if (!leadId) {
    return NextResponse.json({ error: "Chybí ID nemovitosti." }, { status: 400 });
  }

  const [lead] = await db
    .select({
      id: leads.id,
      stage: leads.stage,
      portalVisible: leads.portalVisible,
      portalStatus: leads.portalStatus,
      reservedById: leads.portalReservedInvestorId,
      userId: leads.userId,
      propertyId: leads.propertyId,
      propertyTitle: properties.title,
      propertyAddress: properties.address,
    })
    .from(leads)
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead || lead.stage !== PORTAL_STAGE || (lead.portalVisible ?? 1) !== 1) {
    return NextResponse.json({ error: "Nemovitost není v portálu k dispozici." }, { status: 404 });
  }

  if (action === "reserve") {
    if (lead.portalStatus === "reserved" && lead.reservedById !== session.sub) {
      return NextResponse.json({ error: "Nemovitost je rezervovaná jiným investorem." }, { status: 409 });
    }
    await db
      .update(leads)
      .set({ portalStatus: "reserved", portalReservedInvestorId: session.sub, updatedAt: Date.now() })
      .where(eq(leads.id, leadId));

    try {
      await db.insert(notifications).values({
        id: generateId(),
        userId: lead.userId,
        title: "Rezervace v investor portálu",
        message: `Investor ${session.name} rezervoval nemovitost ${lead.propertyTitle ?? lead.propertyId}${lead.propertyAddress ? `, ${lead.propertyAddress}` : ""}.`,
        type: "portal_reservation",
        read: false,
        data: JSON.stringify({ propertyId: lead.propertyId, leadId: lead.id }),
        createdAt: ts(),
      });
    } catch {
      // Do not block reservation on notification failure
    }

    return NextResponse.json({ ok: true, status: "reserved" });
  }

  if (lead.reservedById !== session.sub) {
    return NextResponse.json({ error: "Můžete uvolnit jen vlastní rezervaci." }, { status: 403 });
  }
  await db
    .update(leads)
    .set({ portalStatus: "available", portalReservedInvestorId: null, updatedAt: Date.now() })
    .where(and(eq(leads.id, leadId), eq(leads.portalReservedInvestorId, session.sub)));
  return NextResponse.json({ ok: true, status: "available" });
}