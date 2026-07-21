import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, leads, propertyAnalysis, activityLog, searches } from "@/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmtTime(d: Date | number): string {
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
    const todayTs = today.getTime();

    const [props, analyses, leadCount, searchCount, recentActivity] = await Promise.all([
      db
        .select({
          id: properties.id,
          title: properties.title,
          price: properties.price,
          firstSeen: properties.firstSeen,
          imageUrls: properties.imageUrls,
          rooms: properties.rooms,
          area: properties.area,
          lat: properties.lat,
          isActive: properties.isActive,
        })
        .from(properties)
        .where(eq(properties.isActive, 1)),

      db
        .select({
          propertyId: propertyAnalysis.propertyId,
          investmentScore: propertyAnalysis.investmentScore,
          undervaluationPct: propertyAnalysis.undervaluationPct,
          netProfit: propertyAnalysis.netProfit,
          roi: propertyAnalysis.roi,
          arv: propertyAnalysis.arv,
          verdictLevel: propertyAnalysis.verdictLevel,
        })
        .from(propertyAnalysis),

      db
        .select({ val: count() })
        .from(leads)
        .where(eq(leads.assignedTo, session.user.id))
        .then((r) => r[0]?.val ?? 0),

      db
        .select({ val: count() })
        .from(searches)
        .where(eq(searches.userId, session.user.id))
        .then((r) => r[0]?.val ?? 0),

      db
        .select({
          id: activityLog.id,
          message: activityLog.message,
          createdAt: activityLog.createdAt,
          type: activityLog.type,
        })
        .from(activityLog)
        .where(eq(activityLog.userId, session.user.id))
        .orderBy(desc(activityLog.createdAt))
        .limit(5),
    ]);

    const todayProperties = props.filter(
      (p) => p.firstSeen && new Date(p.firstSeen).getTime() >= todayTs
    );

    const n = analyses.length;
    const avgScore = n > 0
      ? Math.round(analyses.reduce((s, a) => s + a.investmentScore, 0) / n)
      : 0;
    const avgUndervaluation = n > 0
      ? analyses.reduce((s, a) => s + a.undervaluationPct, 0) / n
      : 0;
    const pipelineProfit = analyses.reduce((s, a) => s + (a.netProfit || 0), 0);

    const activeDeals = props.filter((p) => p.lat !== null).length;

    const recentProps = props
      .sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime())
      .slice(0, 4)
      .map((p) => {
        const analysis = analyses.find((a) => a.propertyId === p.id);
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
          imageUrls: safeJsonParse<string[]>(p.imageUrls, []),
        };
      });

    const topUndervalued = analyses
      .filter((a) => a.undervaluationPct > 0)
      .sort((a, b) => b.undervaluationPct - a.undervaluationPct)
      .slice(0, 8)
      .map((a) => {
        const p = props.find((prop) => prop.id === a.propertyId);
        if (!p) return null;
        return {
          id: p.id,
          title: p.title,
          price: p.price,
          score: a.investmentScore,
          undervaluationPct: Math.round(a.undervaluationPct),
          rooms: p.rooms ?? "—",
          area: p.area ?? 0,
          imageUrls: safeJsonParse<string[]>(p.imageUrls, []),
          verdictLevel: a.verdictLevel,
        };
      })
      .filter(Boolean);

    const activities = recentActivity.map((a) => ({
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
      { label: "Prům. ROI", value: n > 0 ? Math.round(analyses.reduce((s, a) => s + (a.roi || 0), 0) / n) : 0 },
      { label: "ARV celkem", value: analyses.reduce((s, a) => s + (a.arv || 0), 0) },
      { label: "Zisk celkem", value: pipelineProfit },
      { label: "Počet analýz", value: n },
    ];

    return NextResponse.json({
      totalProperties: props.length,
      todayProperties: todayProperties.length,
      totalSearches: searchCount,
      avgUndervaluation: Math.round(avgUndervaluation * 10) / 10,
      pipelineProfit,
      totalLeads: leadCount,
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
