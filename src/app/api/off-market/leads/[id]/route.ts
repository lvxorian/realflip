import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { offMarketLeads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const lead = await db
      .select()
      .from(offMarketLeads)
      .where(eq(offMarketLeads.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Off-market GET detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = { updatedAt: ts() };
    if (body.status) update.status = body.status;
    if (body.notes !== undefined) update.notes = body.notes;

    await db
      .update(offMarketLeads)
      .set(update)
      .where(eq(offMarketLeads.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Off-market PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
