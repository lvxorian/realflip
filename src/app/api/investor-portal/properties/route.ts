import { NextResponse } from "next/server";
import { getInvestorSession } from "@/lib/investor-session";
import { listPortalItems, getInvestorProfile } from "@/lib/investor-portal";

export async function GET() {
  const session = await getInvestorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [items, profile] = await Promise.all([listPortalItems(session.sub), getInvestorProfile(session.sub)]);
  return NextResponse.json({
    items,
    investorName: profile?.name ?? session.name,
    investorBudget: profile?.budget ?? null,
    investorBudgetUnlimited: profile?.budgetUnlimited ?? 0,
  });
}