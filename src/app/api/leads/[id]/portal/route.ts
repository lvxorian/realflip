import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { leads, propertyAnalysis, calculatorPresets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyInvestorsOfOffer } from "@/lib/email/notify-offers";
import { PORTAL_RESERVATION_MS } from "@/lib/portal-reservation";
import { parseCalcSnapshot } from "@/lib/investor-portal-view";
import { COOPERATION_MODELS, COOPERATION_STRATEGIES, COOPERATION_AVAILABILITY, type CooperationAvailability } from "@/lib/cooperation-models";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const patch: Record<string, string | number | null> = { updatedAt: Date.now() };
    if (body.portalVisible !== undefined) patch.portalVisible = body.portalVisible ? 1 : 0;
    if (body.portalStatus !== undefined) {
      if (body.portalStatus !== "available" && body.portalStatus !== "reserved") {
        return NextResponse.json({ error: "Neplatný stav portálu" }, { status: 400 });
      }
      patch.portalStatus = body.portalStatus;
      if (body.portalStatus === "available") patch.portalReservedInvestorId = null;
    }
    if (body.portalReservedInvestorId !== undefined) {
      if (body.portalReservedInvestorId === null) {
        patch.portalReservedInvestorId = null;
        patch.portalReservedStrategy = null;
        patch.portalStatus = "available";
      } else if (typeof body.portalReservedInvestorId === "string" && body.portalReservedInvestorId) {
        patch.portalReservedInvestorId = body.portalReservedInvestorId;
        patch.portalStatus = "reserved";
        if (patch.portalReservedAt === undefined) {
          const now = Date.now();
          patch.portalReservedAt = now;
          patch.portalExpiresAt = now + PORTAL_RESERVATION_MS;
        }
      }
    }
    if (body.portalReservedStrategy !== undefined) {
      if (body.portalReservedStrategy !== null && !(body.portalReservedStrategy in COOPERATION_STRATEGIES)) {
        return NextResponse.json({ error: "Neplatný způsob spolupráce" }, { status: 400 });
      }
      patch.portalReservedStrategy = body.portalReservedStrategy;
    }
    if (body.portalReservedModel !== undefined) {
      if (body.portalReservedModel !== null && !(body.portalReservedModel in COOPERATION_MODELS)) {
        return NextResponse.json({ error: "Neplatný model spolupráce" }, { status: 400 });
      }
      patch.portalReservedModel = body.portalReservedModel;
    }
    if (body.cooperationAvailability !== undefined) {
      if (typeof body.cooperationAvailability !== "string" || !COOPERATION_AVAILABILITY.includes(body.cooperationAvailability as CooperationAvailability)) {
        return NextResponse.json({ error: "Neplatná dostupnost spolupráce" }, { status: 400 });
      }
      const availability = body.cooperationAvailability as CooperationAvailability;
      const lead = await db
        .select({ propertyId: leads.propertyId })
        .from(leads)
        .where(and(eq(leads.id, id), eq(leads.userId, session.user.id)))
        .limit(1)
        .then((r) => r[0]);
      if (lead?.propertyId) {
        const analysisRow = await db
          .select({ calcSnapshot: propertyAnalysis.calcSnapshot })
          .from(propertyAnalysis)
          .where(eq(propertyAnalysis.propertyId, lead.propertyId))
          .limit(1)
          .then((r) => r[0]);
        const snap = parseCalcSnapshot(analysisRow?.calcSnapshot ?? null);
        if (snap && snap.mode === "flip" && snap.cooperation) {
          snap.cooperation.availability = availability;
          await db
            .update(propertyAnalysis)
            .set({ calcSnapshot: JSON.stringify(snap), updatedAt: Date.now() })
            .where(eq(propertyAnalysis.propertyId, lead.propertyId));
          const preset = await db
            .select({ config: calculatorPresets.config })
            .from(calculatorPresets)
            .where(and(
              eq(calculatorPresets.propertyId, lead.propertyId),
              eq(calculatorPresets.userId, session.user.id)
            ))
            .limit(1)
            .then((r) => r[0]);
          if (preset?.config) {
            try {
              const cfg = JSON.parse(preset.config) as Record<string, unknown>;
              cfg.flipStrategy = availability;
              await db
                .update(calculatorPresets)
                .set({ config: JSON.stringify(cfg), updatedAt: Date.now() })
                .where(and(
                  eq(calculatorPresets.propertyId, lead.propertyId),
                  eq(calculatorPresets.userId, session.user.id)
                ));
            } catch {
              void 0;
            }
          }
        }
      }
    }
    if (body.portalExpiresAt !== undefined) {
      if (typeof body.portalExpiresAt === "number" && body.portalExpiresAt > 0) {
        patch.portalExpiresAt = body.portalExpiresAt;
        if (patch.portalReservedAt === undefined) patch.portalReservedAt = Date.now();
      }
    }

    // IDOR ochrana: lead musí vlastnit přihlášený uživatel (stejný scoping
    // jako leads/[id] a leads/[id]/events).
    const owned = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, session.user.id)))
      .limit(1);
    if (owned.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.update(leads).set(patch).where(eq(leads.id, id));

    if (body.portalVisible === true) {
      // after() = waitUntil na Vercel — e-maily se odešlou spolehlivě i po
      // vrácení odpovědi (fire-and-forget se v serverless občas zabil).
      after(() => {
        notifyInvestorsOfOffer(id).catch((err) => {
          console.error("[email] Odeslání nabídek selhalo:", err);
        });
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}