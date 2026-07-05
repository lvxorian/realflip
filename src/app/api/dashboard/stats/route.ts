import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, leads, propertyAnalysis } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allProperties = await db
      .select()
      .from(properties)
      .where(eq(properties.isActive, true));

    const todayProperties = allProperties.filter(
      (p) => p.firstSeen && new Date(p.firstSeen) >= today
    );

    const allAnalysis = await db.select().from(propertyAnalysis);

    const avgUndervaluation =
      allAnalysis.length > 0
        ? allAnalysis.reduce((s, a) => s + a.undervaluationPct, 0) /
          allAnalysis.length
        : 0;

    const pipelineProfit = allAnalysis.reduce(
      (s, a) => s + (a.netProfit || 0),
      0
    );

    const allLeads = await db.select().from(leads);

    const activeDeals = allProperties.filter(
      (p) => p.lat !== null
    ).length;

    return NextResponse.json({
      totalProperties: allProperties.length,
      todayProperties: todayProperties.length,
      avgUndervaluation: Math.round(avgUndervaluation * 10) / 10,
      pipelineProfit,
      totalLeads: allLeads.length,
      activeDeals,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      {
        totalProperties: 0,
        todayProperties: 0,
        avgUndervaluation: 0,
        pipelineProfit: 0,
        totalLeads: 0,
        activeDeals: 0,
      }
    );
  }
}
