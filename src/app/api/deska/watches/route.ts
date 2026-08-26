import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { deskaWatches } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watches = await db
    .select()
    .from(deskaWatches)
    .where(eq(deskaWatches.userId, session.user.id))
    .orderBy(desc(deskaWatches.createdAt));

  return NextResponse.json({ watches });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, keywords, category, dashboardIds, region } = body;

    if (!name || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "name and keywords (array) are required" },
        { status: 400 },
      );
    }

    const watch = await db
      .insert(deskaWatches)
      .values({
        id: generateId(),
        userId: session.user.id,
        name,
        keywords: JSON.stringify(keywords),
        category: category ?? null,
        dashboardIds: JSON.stringify(dashboardIds ?? []),
        region: region ?? null,
        isActive: 1,
        lastCheckedAt: null,
        createdAt: ts(),
      })
      .returning()
      .then((r) => r[0]);

    return NextResponse.json(watch);
  } catch (error) {
    console.error("Deska watches POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const setValues: Record<string, unknown> = {};
    if ("name" in updates) setValues.name = updates.name;
    if ("keywords" in updates) setValues.keywords = JSON.stringify(updates.keywords);
    if ("category" in updates) setValues.category = updates.category;
    if ("dashboardIds" in updates) setValues.dashboardIds = JSON.stringify(updates.dashboardIds);
    if ("region" in updates) setValues.region = updates.region;
    if ("isActive" in updates) setValues.isActive = updates.isActive ? 1 : 0;

    if (Object.keys(setValues).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    await db
      .update(deskaWatches)
      .set(setValues)
      .where(and(eq(deskaWatches.id, id), eq(deskaWatches.userId, session.user.id)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Deska watches PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  await db
    .delete(deskaWatches)
    .where(and(eq(deskaWatches.id, id), eq(deskaWatches.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
