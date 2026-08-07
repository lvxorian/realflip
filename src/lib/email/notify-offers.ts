import { db } from "@/db";
import { leads, properties, propertyAnalysis, investors, investorOfferEmails } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { toPortalView, type PortalRow } from "@/lib/investor-portal-view";
import { sendEmail } from "@/lib/email/send-email";
import { buildOfferEmailHtml } from "@/lib/email/offer-template";
import { filterRecipients } from "@/lib/email/recipients";
import { INVESTOR_BRAND } from "@/lib/investor-brand";
import type { InvestorPortalItem } from "@/lib/investor-portal-view";

export { filterRecipients, type RecipientLike } from "@/lib/email/recipients";

function portalUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL?.replace(/\/+$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}

export async function notifyInvestorsOfOffer(leadId: string): Promise<number> {
  const [row] = await db
    .select({
      leadId: leads.id,
      stage: leads.stage,
      portalVisible: leads.portalVisible,
      portalStatus: leads.portalStatus,
      reservedById: leads.portalReservedInvestorId,
      reservedByName: investors.name,
      isActive: properties.isActive,
      district: propertyAnalysis.locationDistrict,
      city: propertyAnalysis.locationCity,
      condition: properties.condition,
      area: properties.area,
      rooms: properties.rooms,
      floor: properties.floor,
      originalPrice: properties.price,
      stageData: leads.stageData,
      targetPurchasePrice: propertyAnalysis.targetPurchasePrice,
      netProfit: propertyAnalysis.netProfit,
      roi: propertyAnalysis.roi,
      calcMode: propertyAnalysis.calcMode,
    })
    .from(leads)
    .innerJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(propertyAnalysis, eq(leads.propertyId, propertyAnalysis.propertyId))
    .leftJoin(investors, eq(leads.portalReservedInvestorId, investors.id))
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!row || row.stage !== "negotiation" || row.portalVisible !== 1 || row.isActive !== 1) {
    return 0;
  }

  const offer: InvestorPortalItem = toPortalView(row as PortalRow, "offer-email", { budget: null, unlimited: true });

  const candidates = await db
    .select({ id: investors.id, email: investors.email, portalEnabled: investors.portalEnabled })
    .from(investors)
    .where(and(eq(investors.portalEnabled, 1), isNotNull(investors.email)));

  const sentRows = await db
    .select({ investorId: investorOfferEmails.investorId })
    .from(investorOfferEmails)
    .where(eq(investorOfferEmails.leadId, leadId));

  const alreadySent = new Set(sentRows.map((r) => r.investorId));
  const recipients = filterRecipients(candidates, alreadySent);
  if (recipients.length === 0) return 0;

  const baseUrl = portalUrl();
  const html = buildOfferEmailHtml(offer, baseUrl);
  const now = Date.now();
  let sent = 0;

  for (const investor of recipients) {
    const result = await sendEmail({
      to: investor.email!,
      subject: `${INVESTOR_BRAND} · Nová nabídka — ${[offer.city, offer.district].filter(Boolean).join(" · ") || "nemovitost"}`,
      html,
    });
    if (!result.sent) continue;

    await db.insert(investorOfferEmails).values({ id: crypto.randomUUID(), investorId: investor.id, leadId, sentAt: now });
    sent += 1;
  }

  return sent;
}