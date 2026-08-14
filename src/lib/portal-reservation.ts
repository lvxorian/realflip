import { leads, portalWaitlist, investors } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { generateId, ts } from "@/lib/utils";

export const PORTAL_RESERVATION_MS = 72 * 60 * 60 * 1000;

export const COOPERATION_MODELS = {
  flip: "Flip a prodej",
  rent: "Nákup a držení",
  both: "Obojí — flip i držení",
} as const;

export type CooperationModel = keyof typeof COOPERATION_MODELS;

export function modelLabel(model: string | null | undefined): string {
  return model && model in COOPERATION_MODELS ? COOPERATION_MODELS[model as CooperationModel] : "Flexibilní — bez omezení";
}

export type LeadPortalRow = Pick<
  typeof leads.$inferSelect,
  | "id"
  | "portalStatus"
  | "portalReservedInvestorId"
  | "portalReservedModel"
  | "portalReservedAt"
  | "portalExpiresAt"
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

export async function hasWaitlist(investorId: string, leadId: string): Promise<boolean> {
  const rows = await db
    .select({ id: portalWaitlist.id })
    .from(portalWaitlist)
    .where(and(eq(portalWaitlist.investorId, investorId), eq(portalWaitlist.leadId, leadId)))
    .limit(1);
  return rows.length > 0;
}

export type ExpiryResult = { released: number; takenOver: number };

/** Podívá se na pořadník a přiřadí prvnímu čekajícímu rezervaci (respektuje
 *  leads.portal_reserved_model jako filtr na investors.preferred_model).
 *  Vrací ID nově přiřazeného investora, nebo null, když pořadník neobsahuje nikoho. */
export async function assignNextFromWaitlist(leadId: string, now = Date.now()): Promise<string | null> {
  const [lead] = await db
    .select({ portalReservedModel: leads.portalReservedModel })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) return null;

  const queue = await db
    .select({
      investorId: portalWaitlist.investorId,
      createdAt: portalWaitlist.createdAt,
      preferredModel: investors.preferredModel,
    })
    .from(portalWaitlist)
    .innerJoin(investors, eq(portalWaitlist.investorId, investors.id))
    .where(eq(portalWaitlist.leadId, leadId))
    .orderBy(asc(portalWaitlist.createdAt));

  let next = queue[0] ?? null;
  if (next && lead.portalReservedModel) {
    const match = queue.find((w) => w.preferredModel === lead.portalReservedModel);
    next = match ?? next;
  }
  if (!next) return null;

  await db
    .update(leads)
    .set({
      portalStatus: "reserved",
      portalReservedInvestorId: next.investorId,
      portalReservedModel: lead.portalReservedModel ?? next.preferredModel ?? null,
      portalReservedAt: now,
      portalExpiresAt: now + PORTAL_RESERVATION_MS,
      updatedAt: now,
    })
    .where(eq(leads.id, leadId));
  await db
    .delete(portalWaitlist)
    .where(and(eq(portalWaitlist.leadId, leadId), eq(portalWaitlist.investorId, next.investorId)));
  return next.investorId;
}

/** Uvolní prošlé rezervace a předá je prvnímu čekajícímu z pořadníku. */
export async function expireStaleReservations(now = Date.now()): Promise<ExpiryResult> {
  const candidates = await db
    .select({
      id: leads.id,
      portalStatus: leads.portalStatus,
      portalReservedInvestorId: leads.portalReservedInvestorId,
      portalReservedModel: leads.portalReservedModel,
      portalReservedAt: leads.portalReservedAt,
      portalExpiresAt: leads.portalExpiresAt,
    })
    .from(leads)
    .where(eq(leads.portalStatus, "reserved"));

  const expired = candidates.filter((l) => isReservationExpired(l, now));

  let takenOver = 0;
  for (const lead of expired) {
    const assigned = await assignNextFromWaitlist(lead.id, now);
    if (!assigned) {
      await db
        .update(leads)
        .set({ portalStatus: "available", portalReservedInvestorId: null, updatedAt: now })
        .where(eq(leads.id, lead.id));
      continue;
    }
    takenOver += 1;
  }
  return { released: expired.length - takenOver, takenOver };
}

/** Vrátí ID investorů čekajících na danou nemovitost v pořadí fronty. */
export async function waitlistFor(leadId: string): Promise<{ investorId: string; createdAt: number }[]> {
  return db
    .select({ investorId: portalWaitlist.investorId, createdAt: portalWaitlist.createdAt })
    .from(portalWaitlist)
    .where(eq(portalWaitlist.leadId, leadId))
    .orderBy(asc(portalWaitlist.createdAt));
}

export async function addToWaitlist(investorId: string, leadId: string): Promise<boolean> {
  const existing = await hasWaitlist(investorId, leadId);
  if (existing) return false;
  await db
    .insert(portalWaitlist)
    .values({ id: generateId(), investorId, leadId, createdAt: ts() })
    .onConflictDoNothing();
  return true;
}

export async function removeFromWaitlist(investorId: string, leadId: string): Promise<void> {
  await db
    .delete(portalWaitlist)
    .where(and(eq(portalWaitlist.leadId, leadId), eq(portalWaitlist.investorId, investorId)));
}
