import { db } from "@/db";
import { leads, portalWaitlist, properties, propertyAnalysis, investors } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { toPortalView, type InvestorPortalItem } from "@/lib/investor-portal-view";
import { expireStaleReservations } from "@/lib/portal-reservation";

export {
  parseStageData,
  offerPriceOf,
  toPortalView,
} from "@/lib/investor-portal-view";
export type {
  InvestorPortalItem,
  PortalStatus,
  PortalRow,
} from "@/lib/investor-portal-view";

export const PORTAL_STAGE = "negotiation";
export const PORTAL_RESERVE_WINDOW_MS = 15 * 60 * 1000;
export const PORTAL_LOGIN_MAX_ATTEMPTS = 5;

export async function getInvestorProfile(
  investorId: string
): Promise<{ name: string | null; budget: number | null; budgetUnlimited: number | null; email: string | null } | null> {
  const [investor] = await db
    .select({
      name: investors.name,
      budget: investors.budget,
      budgetUnlimited: investors.budgetUnlimited,
      email: investors.email,
    })
    .from(investors)
    .where(eq(investors.id, investorId))
    .limit(1);
  return investor ?? null;
}

export async function listPortalItems(investorId: string): Promise<ReturnType<typeof toPortalView>[]> {
  const investor = await getInvestorProfile(investorId);

  const budget = {
    budget: investor?.budget ?? null,
    unlimited: (investor?.budgetUnlimited ?? 0) === 1,
  };

  try {
    await expireStaleReservations();
  } catch {
    // Expirace nesmí rozbít načtení portálu
  }

  const rows = await db
    .select({
      leadId: leads.id,
      portalStatus: leads.portalStatus,
      reservedById: leads.portalReservedInvestorId,
      reservedByName: investors.name,
      portalExpiresAt: leads.portalExpiresAt,
      portalReservedModel: leads.portalReservedModel,
      district: propertyAnalysis.locationDistrict,
      city: propertyAnalysis.locationCity,
      locationCategory: propertyAnalysis.locationCategory,
      condition: properties.condition,
      area: properties.area,
      rooms: properties.rooms,
      floor: properties.floor,
      originalPrice: properties.price,
      stageData: leads.stageData,
      arv: propertyAnalysis.arv,
      renovationCost: propertyAnalysis.renovationCost,
      monthlyRent: propertyAnalysis.monthlyRent,
      calcMode: propertyAnalysis.calcMode,
      netProfit: propertyAnalysis.netProfit,
      roi: propertyAnalysis.roi,
      annualizedRoi: propertyAnalysis.annualizedRoi,
      cashOnCash: propertyAnalysis.cashOnCash,
      rentalYield: propertyAnalysis.rentalYield,
      cashFlowMonthly: propertyAnalysis.cashFlowMonthly,
      calcSnapshot: propertyAnalysis.calcSnapshot,
    })
    .from(leads)
    .innerJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(propertyAnalysis, eq(leads.propertyId, propertyAnalysis.propertyId))
    .leftJoin(investors, eq(leads.portalReservedInvestorId, investors.id))
    .where(and(eq(leads.stage, PORTAL_STAGE), eq(leads.portalVisible, 1), eq(properties.isActive, 1)))
    .orderBy(propertyAnalysis.netProfit);

  const leadIds = rows.map((r) => r.leadId);
  const waitlisted = new Set<string>();
  if (leadIds.length > 0) {
    const waitlistRows = await db
      .select({ leadId: portalWaitlist.leadId })
      .from(portalWaitlist)
      .where(and(eq(portalWaitlist.investorId, investorId), inArray(portalWaitlist.leadId, leadIds)));
    waitlistRows.forEach((w) => waitlisted.add(w.leadId));
  }

  const score = (item: InvestorPortalItem) =>
    item.calcMode === "rental"
      ? item.deal.type === "rental" ? item.deal.netYield ?? -Infinity : -Infinity
      : item.deal.type === "flip" ? item.deal.netProfit ?? -Infinity : -Infinity;

  return rows
    .map((row) => toPortalView(row, investorId, budget, waitlisted))
    .sort((a, b) => score(b) - score(a));
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + PORTAL_RESERVE_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= PORTAL_LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}