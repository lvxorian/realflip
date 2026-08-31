import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aresCompanies } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const pipeline = searchParams.get("pipeline");
    const status = searchParams.get("status");
    const minScore = parseInt(searchParams.get("minScore") ?? "0", 10);
    const apartmentOnly = searchParams.get("apartment") === "1";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = (page - 1) * limit;

    const conditions = [];

    if (pipeline) conditions.push(eq(aresCompanies.pipeline, pipeline));
    if (status) conditions.push(eq(aresCompanies.status, status));
    if (minScore > 0) conditions.push(sql`${aresCompanies.score} >= ${minScore}`);
    if (apartmentOnly) conditions.push(eq(aresCompanies.apartmentFound, 1));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [companies, countResult] = await Promise.all([
      db
        .select()
        .from(aresCompanies)
        .where(where)
        .orderBy(desc(aresCompanies.score), desc(aresCompanies.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(aresCompanies)
        .where(where)
        .then((r) => r[0].count),
    ]);

    return NextResponse.json({ companies, total: countResult });
  } catch (error) {
    console.error("ARES companies GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
