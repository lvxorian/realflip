import { NextResponse } from "next/server";
import { getInvestorSession } from "@/lib/investor-session";
import { listPortalItems, getInvestorProfile } from "@/lib/investor-portal";
import { touchInvestorActivity } from "@/lib/investor-activity-actions";

export async function GET() {
  const session = await getInvestorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await touchInvestorActivity(session.sub);
  const [items, profile] = await Promise.all([listPortalItems(session.sub), getInvestorProfile(session.sub)]);
  return NextResponse.json({
    items,
    investorName: profile?.name ?? session.name,
    investorBudget: profile?.budget ?? null,
    investorBudgetUnlimited: profile?.budgetUnlimited ?? 0,
    investorEmail: profile?.email ?? null,
  });
}