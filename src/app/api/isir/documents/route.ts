import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { insolvencyEvents } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const minScore = parseInt(searchParams.get("minScore") ?? "0", 10);
    const section = searchParams.get("section");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (status) {
      conditions.push(eq(insolvencyEvents.status, status));
    }
    if (minScore > 0) {
      conditions.push(sql`${insolvencyEvents.score} >= ${minScore}`);
    }
    if (section) {
      conditions.push(eq(insolvencyEvents.section, section));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [events, countResult] = await Promise.all([
      db
        .select()
        .from(insolvencyEvents)
        .where(where)
        .orderBy(desc(insolvencyEvents.score), desc(insolvencyEvents.publishedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(insolvencyEvents)
        .where(where)
        .then((r) => r[0].count),
    ]);

    return NextResponse.json({ events, total: countResult });
  } catch (error) {
    console.error("ISIR documents GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
