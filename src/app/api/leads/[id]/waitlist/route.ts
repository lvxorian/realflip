import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { leads, portalWaitlist, investors } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  COOPERATION_MODELS,
  PORTAL_RESERVATION_MS,
  removeFromWaitlist,
} from "@/lib/portal-reservation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [lead] = await db
      .select({
        portalStatus: leads.portalStatus,
        portalReservedInvestorId: leads.portalReservedInvestorId,
        portalReservedModel: leads.portalReservedModel,
        portalExpiresAt: leads.portalExpiresAt,
      })
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);

    const queue = await db
      .select({
        investorId: portalWaitlist.investorId,
        createdAt: portalWaitlist.createdAt,
        name: investors.name,
        city: investors.city,
        preferredModel: investors.preferredModel,
      })
      .from(portalWaitlist)
      .innerJoin(investors, eq(portalWaitlist.investorId, investors.id))
      .where(eq(portalWaitlist.leadId, id))
      .orderBy(asc(portalWaitlist.createdAt));

    const waitlist = queue.map((row, index) => ({
      ...row,
      position: index + 1,
      modelLabel: row.preferredModel && row.preferredModel in COOPERATION_MODELS
        ? COOPERATION_MODELS[row.preferredModel as keyof typeof COOPERATION_MODELS]
        : null,
    }));

    return NextResponse.json({
      waitlist,
      reservationInMs: PORTAL_RESERVATION_MS,
      lead: lead ?? null,
      reservedInvestorId: lead?.portalReservedInvestorId ?? null,
      reservedModel: lead?.portalReservedModel ?? null,
      reservedExpiresAt: lead?.portalExpiresAt ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const action = body.action as "assign" | "remove";
    const investorId = typeof body.investorId === "string" ? body.investorId : "";
    if (!investorId) {
      return NextResponse.json({ error: "Chybí ID investora" }, { status: 400 });
    }

    if (action === "remove") {
      await removeFromWaitlist(investorId, id);
      return NextResponse.json({ ok: true });
    }

    if (action === "assign") {
      const [investor] = await db
        .select({ preferredModel: investors.preferredModel })
        .from(investors)
        .where(eq(investors.id, investorId))
        .limit(1);
      if (!investor) {
        return NextResponse.json({ error: "Investor neexistuje" }, { status: 404 });
      }

      const [lead] = await db
        .select({ portalReservedModel: leads.portalReservedModel })
        .from(leads)
        .where(eq(leads.id, id))
        .limit(1);

      const now = Date.now();
      await db
        .update(leads)
        .set({
          portalStatus: "reserved",
          portalReservedInvestorId: investorId,
          portalReservedModel: lead?.portalReservedModel ?? investor.preferredModel ?? null,
          portalReservedAt: now,
          portalExpiresAt: now + PORTAL_RESERVATION_MS,
          updatedAt: now,
        })
        .where(eq(leads.id, id));
      await removeFromWaitlist(investorId, id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Neplatná akce" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}