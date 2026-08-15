import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/db";

export const PORTAL_RESERVATION_MS = 72 * 60 * 60 * 1000;

export type LeadPortalRow = Pick<
  typeof leads.$inferSelect,
  "id" | "portalStatus" | "portalReservedInvestorId" | "portalReservedAt" | "portalExpiresAt"
>;

export function reservationExpiry(lead: LeadPortalRow): number | null {
  if (lead.portalExpiresAt != null) return lead.portalExpiresAt;
  if (lead.portalStatus === "reserved" && lead.portalReservedAt != null) {
    return lead.portalReservedAt + PORTAL_RESERVATION_MS;
  }
  return null;
}

export function isReservationExpired(lead: LeadPortalRow, now = Date.now()): boolean {
  if (lead.portalStatus !== "reserved" || lead.portalReservedInvestorId == null) return false;
  const expiry = reservationExpiry(lead);
  return expiry != null && expiry <= now;
}

/** Uvolní prošlé rezervace (vrátí je na „Dostupná"). */
export async function expireStaleReservations(now = Date.now()): Promise<number> {
  const candidates = await db
    .select({
      id: leads.id,
      portalStatus: leads.portalStatus,
      portalReservedInvestorId: leads.portalReservedInvestorId,
      portalReservedAt: leads.portalReservedAt,
      portalExpiresAt: leads.portalExpiresAt,
    })
    .from(leads)
    .where(eq(leads.portalStatus, "reserved"));

  const expired = candidates.filter((l) => isReservationExpired(l, now));
  if (expired.length === 0) return 0;

  for (const lead of expired) {
    await db
      .update(leads)
      .set({ portalStatus: "available", portalReservedInvestorId: null, updatedAt: now })
      .where(eq(leads.id, lead.id));
  }
  return expired.length;
}
