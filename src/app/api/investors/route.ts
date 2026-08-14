import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { investors, leads, investorOfferEmails } from "@/db/schema";
import { desc, isNotNull, sql } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { deriveInvestorCredentials } from "@/lib/investor-credentials";
import { COOPERATION_MODELS } from "@/lib/portal-reservation";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.select().from(investors).orderBy(desc(investors.createdAt));

    const reservationRows = await db
      .select({
        investorId: leads.portalReservedInvestorId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(leads)
      .where(isNotNull(leads.portalReservedInvestorId))
      .groupBy(leads.portalReservedInvestorId);

    const offerEmailRows = await db
      .select({
        investorId: investorOfferEmails.investorId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(investorOfferEmails)
      .groupBy(investorOfferEmails.investorId);

    const reservationMap = new Map(reservationRows.map((r) => [r.investorId, Number(r.count)]));
    const offerEmailMap = new Map(offerEmailRows.map((r) => [r.investorId, Number(r.count)]));

    const result = rows.map((r) => ({
      ...r,
      reservations: reservationMap.get(r.id) ?? 0,
      offerEmails: offerEmailMap.get(r.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Jméno investora je povinné" }, { status: 400 });
    }

    const budget = typeof body.budget === "number" && body.budget >= 0 ? Math.round(body.budget) : null;
    const budgetUnlimited = body.budgetUnlimited ? 1 : 0;
    const portalEnabled = body.portalEnabled ? 1 : 0;
    const preferredModel =
      body.preferredModel && body.preferredModel in COOPERATION_MODELS ? body.preferredModel : null;
    if (portalEnabled && !deriveInvestorCredentials(name).password) {
      return NextResponse.json({ error: "Pro přístup k portálu zadejte jméno i příjmení investora" }, { status: 400 });
    }
    const now = ts();

    const id = generateId();
    await db.insert(investors).values({
      id,
      name,
      city: typeof body.city === "string" && body.city.trim() ? body.city.trim() : null,
      phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
      email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
      budget,
      budgetUnlimited,
      portalEnabled,
      preferredModel,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id, name, city: null, phone: null, email: null, budget, budgetUnlimited, portalEnabled, notes: null, createdAt: now, updatedAt: now }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
