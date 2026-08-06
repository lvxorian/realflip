import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ts } from "@/lib/utils";
import { isValidLeadStage } from "@/lib/leads";
import { notifyInvestorsOfOffer } from "@/lib/email/notify-offers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.stage !== undefined && !isValidLeadStage(body.stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    const allowed = ["stage", "priority", "notes", "assignedTo"];
    const update: Record<string, unknown> = { updatedAt: ts() };
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    // Stage-specific structured data (meeting/offer/negotiation)
    if (body.stageData !== undefined) {
      if (typeof body.stageData !== "object" || body.stageData === null || Array.isArray(body.stageData)) {
        return NextResponse.json({ error: "Invalid stageData" }, { status: 400 });
      }
      const isCloud = !!process.env.DATABASE_URL;
      update.stageData = isCloud ? body.stageData : JSON.stringify(body.stageData);
    }

    await db
      .update(leads)
      .set(update)
      .where(and(eq(leads.id, id), eq(leads.userId, session.user.id)));

    if (body.stage === "negotiation") {
      notifyInvestorsOfOffer(id).catch((err) => {
        console.error("[email] Odeslání nabídek selhalo:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
