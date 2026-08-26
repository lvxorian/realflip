import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { deskaDocuments } from "@/db/schema";
import { eq, and, like, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const relevance = searchParams.get("relevance");
    const search = searchParams.get("search");
    const archived = searchParams.get("archived") === "1";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (archived) {
      conditions.push(eq(deskaDocuments.isArchived, 1));
    } else {
      conditions.push(eq(deskaDocuments.isArchived, 0));
    }

    if (category) {
      conditions.push(eq(deskaDocuments.category, category));
    }
    if (relevance) {
      conditions.push(eq(deskaDocuments.relevance, relevance));
    }
    if (search) {
      const q = `%${search}%`;
      conditions.push(
        like(deskaDocuments.name, q) as any,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [documents, countResult] = await Promise.all([
      db
        .select()
        .from(deskaDocuments)
        .where(where)
        .orderBy(desc(deskaDocuments.scrapedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(deskaDocuments)
        .where(where)
        .then((r) => r[0].count),
    ]);

    return NextResponse.json({ documents, total: countResult });
  } catch (error) {
    console.error("Deska documents GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
