import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications, leads } from "@/db/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function unreadReservationNotifications(userId: string) {
  return db
    .select({ id: notifications.id, data: notifications.data })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, "portal_reservation"),
        eq(notifications.read, false),
      ),
    );
}

function leadIdFromNotification(data: string | null): string | null {
  const parsed = safeJsonParse(data, null) as { leadId?: string } | null;
  return parsed?.leadId && typeof parsed.leadId === "string" && parsed.leadId.length > 0
    ? parsed.leadId
    : null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get unread reservation notifications with their data
    const unreadNotifs = await unreadReservationNotifications(session.user.id);

    // Extract leadIds from notification data and find which investor reserved them
    const leadIds = unreadNotifs.map((n) => leadIdFromNotification(n.data)).filter((id): id is string => id !== null);

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

    // Total is consistent with per-investor badges — only reservations that are
    // still actually held count (released/expired ones no longer keep the badge).
    const total = Object.values(byInvestor).reduce((s, n) => s + n, 0);

    return NextResponse.json({ total, byInvestor });
  } catch {
    return NextResponse.json({ total: 0, byInvestor: {} });
  }
}

/** Označí nečtené rezervační notifikace jako přečtené. Bez investorId všechny,
 *  s investorId jen ty, jejichž lead je aktuálně rezervovaný tím investorem. */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const investorId = typeof body?.investorId === "string" ? body.investorId : null;

    const unreadNotifs = await unreadReservationNotifications(session.user.id);

    if (investorId) {
      const leadIds = unreadNotifs.map((n) => leadIdFromNotification(n.data)).filter((id): id is string => id !== null);
      let targetIds: string[] = [];
      if (leadIds.length > 0) {
        const reserved = await db
          .select({ leadId: leads.id })
          .from(leads)
          .where(and(inArray(leads.id, leadIds), eq(leads.portalReservedInvestorId, investorId)));
        const reservedSet = new Set(reserved.map((r) => r.leadId));
        targetIds = unreadNotifs
          .filter((n) => {
            const leadId = leadIdFromNotification(n.data);
            return leadId !== null && reservedSet.has(leadId);
          })
          .map((n) => n.id);
      }
      if (targetIds.length > 0) {
        await db
          .update(notifications)
          .set({ read: true })
          .where(and(inArray(notifications.id, targetIds), eq(notifications.userId, session.user.id)));
      }
    } else if (unreadNotifs.length > 0) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            inArray(notifications.id, unreadNotifs.map((n) => n.id)),
            eq(notifications.userId, session.user.id),
          ),
        );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to mark notifications read" }, { status: 500 });
  }
}
