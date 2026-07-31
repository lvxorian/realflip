import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { searches, searchProperties, properties, propertyAnalysis } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ts, safeJsonParse } from "@/lib/utils";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const search = await db
      .select()
      .from(searches)
      .where(and(eq(searches.id, id), eq(searches.userId, userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!search) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const linked = await db
      .select({
        propertyId: searchProperties.propertyId,
        firstSeen: searchProperties.firstSeen,
        lastSeen: searchProperties.lastSeen,
        property: properties,
        analysis: propertyAnalysis,
      })
      .from(searchProperties)
      .innerJoin(properties, eq(searchProperties.propertyId, properties.id))
      .leftJoin(propertyAnalysis, eq(searchProperties.propertyId, propertyAnalysis.propertyId))
      .where(
        and(
          eq(searchProperties.searchId, id),
          eq(properties.isActive, 1),
        ),
      )
      .orderBy(desc(searchProperties.lastSeen));

    const num = (v: unknown) => (v == null ? v : Number(v));

    const results = linked.map((r) => ({
      ...r,
      firstSeen: Number(r.firstSeen),
      lastSeen: Number(r.lastSeen),
      property: {
        ...r.property,
        firstSeen: Number(r.property.firstSeen),
        lastSeen: Number(r.property.lastSeen),
      },
    }));

    return NextResponse.json({
      ...search,
      filters: safeJsonParse<Record<string, unknown>>(search.filters, {}),
      lastRunAt: num(search.lastRunAt),
      createdAt: Number(search.createdAt),
      updatedAt: Number(search.updatedAt),
      results,
      total: results.length,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const update: Record<string, unknown> = { updatedAt: ts() };

    if (body.name) update.name = body.name;
    if (body.filters) update.filters = JSON.stringify(body.filters);
    if (body.schedule) update.schedule = body.schedule;

    await db
      .update(searches)
      .set(update)
      .where(and(eq(searches.id, id), eq(searches.userId, userId)));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db
      .delete(searches)
      .where(and(eq(searches.id, id), eq(searches.userId, userId)));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
