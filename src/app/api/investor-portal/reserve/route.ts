import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { investors, leads, notifications, properties, propertyAnalysis } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getInvestorSession } from "@/lib/investor-session";
import { PORTAL_STAGE } from "@/lib/investor-portal";
import { PORTAL_RESERVATION_MS } from "@/lib/portal-reservation";
import { touchInvestorActivity } from "@/lib/investor-activity-actions";
import { generateId, ts } from "@/lib/utils";
import { flipCooperationFromSnapshot, parseCalcSnapshot } from "@/lib/investor-portal-view";
import { getPortalConfig } from "@/lib/portal-config";
import { COOPERATION_STRATEGIES } from "@/lib/cooperation-models";

export async function POST(req: NextRequest) {
  const session = await getInvestorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await touchInvestorActivity(session.sub);

  let body: { id?: string; action?: "reserve" | "cancel"; strategy?: string };
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
      preferredModel: investors.preferredModel,
      calcMode: propertyAnalysis.calcMode,
      calcSnapshot: propertyAnalysis.calcSnapshot,
      userId: leads.userId,
      propertyId: leads.propertyId,
      propertyTitle: properties.title,
      propertyAddress: properties.address,
    })
    .from(leads)
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(propertyAnalysis, eq(leads.propertyId, propertyAnalysis.propertyId))
    .leftJoin(investors, eq(investors.id, session.sub))
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead || lead.stage !== PORTAL_STAGE || (lead.portalVisible ?? 1) !== 1) {
    return NextResponse.json({ error: "Nemovitost není v portálu k dispozici." }, { status: 404 });
  }

  const config = await getPortalConfig();
  const flipSnapshot = parseCalcSnapshot(lead.calcSnapshot);
  const allowedStrategies =
    lead.calcMode === "flip"
      ? (flipCooperationFromSnapshot(flipSnapshot && flipSnapshot.mode === "flip" ? flipSnapshot : null)?.availableStrategies ?? ["fifty-fifty", "sourcing-fee"])
          .filter((s) => config.fiftyFiftyEnabled || s !== "fifty-fifty")
      : [];

  if (action === "reserve") {
    if (lead.portalStatus === "reserved" && lead.reservedById !== session.sub) {
      return NextResponse.json({ error: "Nemovitost je rezervovaná jiným investorem." }, { status: 409 });
    }
    let strategy: string | null = null;
    if (lead.calcMode === "flip") {
      if (typeof body.strategy !== "string" || (body.strategy !== "fifty-fifty" && body.strategy !== "sourcing-fee")) {
        return NextResponse.json({ error: "Vyberte způsob spolupráce (50/50 nebo sourcing fee)." }, { status: 400 });
      }
      if (!allowedStrategies.includes(body.strategy)) {
        return NextResponse.json(
          { error: body.strategy === "fifty-fifty" ? config.fiftyFiftyNotice : "Tento způsob spolupráce není u této nabídky dostupný." },
          { status: 409 }
        );
      }
      strategy = body.strategy;
    }
    const now = Date.now();
    await db
      .update(leads)
      .set({
        portalStatus: "reserved",
        portalReservedInvestorId: session.sub,
        portalReservedModel: lead.preferredModel ?? null,
        portalReservedStrategy: strategy,
        portalReservedAt: now,
        portalExpiresAt: now + PORTAL_RESERVATION_MS,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId));

    try {
      const strategyLabel =
        strategy && strategy in COOPERATION_STRATEGIES
          ? COOPERATION_STRATEGIES[strategy as keyof typeof COOPERATION_STRATEGIES]
          : null;
      await db.insert(notifications).values({
        id: generateId(),
        userId: lead.userId,
        title: "Rezervace v investor portálu",
        message: `Investor ${session.name} rezervoval nemovitost ${lead.propertyTitle ?? lead.propertyId}${lead.propertyAddress ? `, ${lead.propertyAddress}` : ""}${strategyLabel ? ` — model ${strategyLabel}` : ""}.`,
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
    .set({ portalStatus: "available", portalReservedInvestorId: null, portalReservedStrategy: null, updatedAt: Date.now() })
    .where(and(eq(leads.id, leadId), eq(leads.portalReservedInvestorId, session.sub)));
  return NextResponse.json({ ok: true, status: "available" });
}
