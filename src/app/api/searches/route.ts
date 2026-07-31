import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { searches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts, safeJsonParse } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, filters, schedule } = await req.json();

    if (!name || !filters) {
      return NextResponse.json({ error: "Name and filters required" }, { status: 400 });
    }

    const id = generateId();
    const now = ts();

    await db.insert(searches).values({
      id,
      userId,
      name,
      filters: JSON.stringify(filters),
      schedule: schedule ?? "manual",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id, name, filters, schedule: schedule ?? "manual" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await db
      .select()
      .from(searches)
      .where(eq(searches.userId, userId))
      .orderBy(searches.createdAt);

    const num = (v: unknown) => (v == null ? v : Number(v));

    const parsed = items.map((s) => ({
      ...s,
      filters: safeJsonParse<Record<string, unknown>>(s.filters, {}),
      lastRunAt: num(s.lastRunAt),
      createdAt: Number(s.createdAt),
      updatedAt: Number(s.updatedAt),
    }));

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
