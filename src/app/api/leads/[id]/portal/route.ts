import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";

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
        patch.portalStatus = "available";
      } else if (typeof body.portalReservedInvestorId === "string" && body.portalReservedInvestorId) {
        patch.portalReservedInvestorId = body.portalReservedInvestorId;
        patch.portalStatus = "reserved";
      }
    }

    await db.update(leads).set(patch).where(eq(leads.id, id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}