import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadEvents } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { normalizeLeadEvent } from "@/lib/lead-events";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, session.user.id)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(leadEvents)
      .where(eq(leadEvents.leadId, id))
      .orderBy(desc(leadEvents.createdAt))
      .limit(50);

    return NextResponse.json(rows.map(normalizeLeadEvent));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}