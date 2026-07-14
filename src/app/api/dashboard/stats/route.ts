import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, leads, propertyAnalysis, activityLog, searches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function fmtTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "právě teď";
  if (min < 60) return `před ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.floor(hours / 24);
  return `před ${days} dny`;
}

function statusLabel(days: number, score: number | null): string {
  if (days <= 2) return "Nový";
  if (score && score >= 80) return "Doporučeno";
  if (days <= 7) return "Sledovaný";
  return "Aktivní";
}

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

    const avgScore =
      allAnalysis.length > 0
        ? Math.round(
            allAnalysis.reduce((s, a) => s + a.investmentScore, 0) /
              allAnalysis.length
          )
        : 0;

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
    const allSearches = await db.select().from(searches);

    const activeDeals = allProperties.filter((p) => p.lat !== null).length;

    const recentProps = allProperties
      .sort(
        (a, b) =>
          new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime()
      )
      .slice(0, 4)
      .map((p) => {
        const analysis = allAnalysis.find((a) => a.propertyId === p.id);
        const daysOnMarket = Math.floor(
          (Date.now() - new Date(p.firstSeen).getTime()) / 86400000
        );
        return {
          id: p.id,
          title: p.title,
          price: p.price,
          score: analysis?.investmentScore ?? 0,
          rooms: p.rooms ?? "—",
          area: p.area ?? 0,
          status: statusLabel(daysOnMarket, analysis?.investmentScore ?? null),
          days: daysOnMarket,
          imageUrls: p.imageUrls ? JSON.parse(p.imageUrls) : [],
        };
      });

    const recentActivities = await db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(5);

    const topUndervalued = allAnalysis
      .filter((a) => a.undervaluationPct > 0)
      .sort((a, b) => b.undervaluationPct - a.undervaluationPct)
      .slice(0, 8)
      .map((a) => {
        const p = allProperties.find((prop) => prop.id === a.propertyId);
        if (!p) return null;
        return {
          id: p.id,
          title: p.title,
          price: p.price,
          score: a.investmentScore,
          undervaluationPct: Math.round(a.undervaluationPct),
          rooms: p.rooms ?? "—",
          area: p.area ?? 0,
          imageUrls: p.imageUrls ? JSON.parse(p.imageUrls) : [],
          verdictLevel: a.verdictLevel,
        };
      })
      .filter(Boolean);

    const activities = recentActivities.map((a) => ({
      id: a.id,
      text: a.message,
      time: fmtTime(a.createdAt),
      type: a.type,
      status:
        a.type === "price"
          ? ("active" as const)
          : a.type === "scraping"
          ? ("success" as const)
          : a.type === "call"
          ? ("idle" as const)
          : ("active" as const),
    }));

    const portfolioData = [
      { label: "Prům. ROI", value: allAnalysis.length > 0 ? Math.round(allAnalysis.reduce((s, a) => s + (a.roi || 0), 0) / allAnalysis.length) : 0 },
      { label: "ARV celkem", value: allAnalysis.reduce((s, a) => s + (a.arv || 0), 0) },
      { label: "Zisk celkem", value: pipelineProfit },
      { label: "Počet analýz", value: allAnalysis.length },
    ];

    return NextResponse.json({
      totalProperties: allProperties.length,
      todayProperties: todayProperties.length,
      totalSearches: allSearches.length,
      avgUndervaluation: Math.round(avgUndervaluation * 10) / 10,
      pipelineProfit,
      totalLeads: allLeads.length,
      activeDeals,
      avgScore,
      recentProperties: recentProps,
      topUndervalued,
      portfolioData,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      {
        totalProperties: 0,
        todayProperties: 0,
        totalSearches: 0,
        avgUndervaluation: 0,
        pipelineProfit: 0,
        totalLeads: 0,
        activeDeals: 0,
        avgScore: 0,
        recentProperties: [],
        topUndervalued: [],
        portfolioData: [],
      }
    );
  }
}
