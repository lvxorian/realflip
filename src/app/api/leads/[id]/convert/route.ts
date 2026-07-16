import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { leads, deals } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await params;

    const lead = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, session.user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.stage !== "closed") {
      return NextResponse.json({ error: "Lead must be in closed stage" }, { status: 400 });
    }

    const existingDeal = await db
      .select()
      .from(deals)
      .where(eq(deals.propertyId, lead.propertyId))
      .limit(1)
      .then((r) => r[0]);

    if (existingDeal) {
      return NextResponse.json({ dealId: existingDeal.id });
    }

    const body = await req.json();
    const now = ts();
    const dealId = generateId();

    await db.insert(deals).values({
      id: dealId,
      propertyId: lead.propertyId,
      purchasePrice: body.purchasePrice ?? 0,
      purchaseDate: now,
      renovationBudget: body.renovationBudget ?? null,
      status: "purchased",
      notes: body.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ dealId });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
