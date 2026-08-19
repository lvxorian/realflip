import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications, leads } from "@/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Total unread reservation notifications for this admin user
    const [totalRow] = await db
      .select({ c: sql<number>`cast(count(*) as integer)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.type, "portal_reservation"),
          eq(notifications.read, false),
        ),
      );

    // Get unread reservation notifications with their data
    const unreadNotifs = await db
      .select({ data: notifications.data })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.type, "portal_reservation"),
          eq(notifications.read, false),
        ),
      );

    // Extract leadIds from notification data and find which investor reserved them
    const leadIds = unreadNotifs
      .map((n) => {
        const parsed = safeJsonParse(n.data, null) as { leadId?: string } | null;
        return parsed?.leadId;
      })
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const byInvestor: Record<string, number> = {};

    if (leadIds.length > 0) {
      const reservedLeads = await db
        .select({
          leadId: leads.id,
          investorId: leads.portalReservedInvestorId,
        })
        .from(leads)
        .where(isNotNull(leads.portalReservedInvestorId));

      const leadToInvestor = new Map(reservedLeads.map((r) => [r.leadId, r.investorId!]));
      for (const leadId of leadIds) {
        const investorId = leadToInvestor.get(leadId);
        if (investorId) {
          byInvestor[investorId] = (byInvestor[investorId] ?? 0) + 1;
        }
      }
    }

    return NextResponse.json({ total: Number(totalRow?.c ?? 0), byInvestor });
  } catch {
    return NextResponse.json({ total: 0, byInvestor: {} });
  }
}
