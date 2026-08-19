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
import { INVESTOR_BRAND } from "@/lib/investor-brand";
import { sendEmail } from "@/lib/email/send-email";
import { buildReservationEmailHtml } from "@/lib/email/reservation-template";
import { buildAdminReservationNotificationHtml } from "@/lib/email/admin-reservation-template";

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
        portalReservedModel: lead.calcMode ?? null,
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

    // --- Reservation confirmation email to investor ---
    try {
      const investorRow = await db
        .select({ email: investors.email, name: investors.name })
        .from(investors)
        .where(eq(investors.id, session.sub))
        .limit(1);
      const investorEmail = investorRow[0]?.email;
      if (investorEmail) {
        const baseUrl = (
          process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL?.replace(/\/+$/, "") ??
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
          "http://localhost:3000"
        );
        const html = buildReservationEmailHtml({
          investorName: session.name,
          propertyTitle: lead.propertyTitle ?? null,
          propertyAddress: lead.propertyAddress ?? null,
          strategy: strategy as "fifty-fifty" | "sourcing-fee" | null,
          baseUrl,
        });
        const location = [lead.propertyTitle, lead.propertyAddress].filter(Boolean).join(" · ") || "nemovitost";
        const subject = `${INVESTOR_BRAND} · Potvrzení rezervace — ${location}`;
        await sendEmail({ to: investorEmail, subject, html });
      }
    } catch {
      // Do not block reservation on email failure
    }

    // --- Admin email notification ---
    try {
      const adminEmail = "cakmak@tuta.com";
      const baseUrl = (
        process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL?.replace(/\/+$/, "") ??
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
        "http://localhost:3000"
      );

      // Compute our profit from the snapshot
      let ourProfit: number | null = null;
      const coop = flipCooperationFromSnapshot(flipSnapshot && flipSnapshot.mode === "flip" ? flipSnapshot : null);
      if (coop && strategy) {
        if (strategy === "sourcing-fee") {
          ourProfit = coop.sourcingFee ?? null;
        } else if (strategy === "fifty-fifty") {
          // Our half of the total profit
          ourProfit = coop.netProfitTotal != null ? Math.round(coop.netProfitTotal / 2) : null;
        }
      }

      const adminHtml = buildAdminReservationNotificationHtml({
        investorName: session.name,
        propertyTitle: lead.propertyTitle ?? null,
        propertyAddress: lead.propertyAddress ?? null,
        strategy: strategy as "fifty-fifty" | "sourcing-fee" | null,
        calcMode: lead.calcMode,
        ourProfit,
        baseUrl,
      });
      const location = [lead.propertyTitle, lead.propertyAddress].filter(Boolean).join(" · ") || "nemovitost";
      const adminSubject = `${INVESTOR_BRAND} · Nová rezervace — ${session.name} · ${location}`;
      await sendEmail({ to: adminEmail, subject: adminSubject, html: adminHtml });
    } catch {
      // Do not block reservation on admin email failure
    }

    return NextResponse.json({
      ok: true,
      status: "reserved",
      reservation: {
        propertyTitle: lead.propertyTitle ?? null,
        propertyAddress: lead.propertyAddress ?? null,
        strategy: strategy as string | null,
        strategyLabel:
          strategy && strategy in COOPERATION_STRATEGIES
            ? COOPERATION_STRATEGIES[strategy as keyof typeof COOPERATION_STRATEGIES]
            : null,
      },
    });
  }

  if (lead.reservedById !== session.sub) {
    return NextResponse.json({ error: "Můžete uvolnit jen vlastní rezervaci." }, { status: 403 });
  }
  await db
    .update(leads)
    .set({ portalStatus: "available", portalReservedInvestorId: null, portalReservedStrategy: null, updatedAt: Date.now() })
    .where(and(eq(leads.id, leadId), eq(leads.portalReservedInvestorId, session.sub)));

  // --- Cancellation emails ---
  const cancelBaseUrl = (
    process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL?.replace(/\/+$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
  const cancelLocation = [lead.propertyTitle, lead.propertyAddress].filter(Boolean).join(" · ") || "nemovitost";

  // Email to investor
  try {
    const investorRow = await db
      .select({ email: investors.email, name: investors.name })
      .from(investors)
      .where(eq(investors.id, session.sub))
      .limit(1);
    const investorEmail = investorRow[0]?.email;
    if (investorEmail) {
      const { buildCancelReservationInvestorHtml } = await import("@/lib/email/cancel-reservation-template");
      const html = buildCancelReservationInvestorHtml({
        investorName: session.name,
        propertyTitle: lead.propertyTitle ?? null,
        propertyAddress: lead.propertyAddress ?? null,
        baseUrl: cancelBaseUrl,
      });
      const subject = `${INVESTOR_BRAND} · Rezervace zrušena — ${cancelLocation}`;
      await sendEmail({ to: investorEmail, subject, html });
    }
  } catch {
    // Do not block cancellation on email failure
  }

  // Email to admin
  try {
    const { buildCancelReservationAdminHtml } = await import("@/lib/email/cancel-reservation-template");
    const adminHtml = buildCancelReservationAdminHtml({
      investorName: session.name,
      propertyTitle: lead.propertyTitle ?? null,
      propertyAddress: lead.propertyAddress ?? null,
      baseUrl: cancelBaseUrl,
    });
    const adminSubject = `${INVESTOR_BRAND} · Zrušení rezervace — ${session.name} · ${cancelLocation}`;
    await sendEmail({ to: "cakmak@tuta.com", subject: adminSubject, html: adminHtml });
  } catch {
    // Do not block cancellation on admin email failure
  }

  return NextResponse.json({ ok: true, status: "available" });
}
