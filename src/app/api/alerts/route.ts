import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ts } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: alerts.id,
        userId: alerts.userId,
        name: alerts.name,
        conditions: alerts.conditions,
        channels: alerts.channels,
        isActive: alerts.isActive,
        lastTriggered: alerts.lastTriggered,
        createdAt: alerts.createdAt,
        updatedAt: alerts.updatedAt,
      })
      .from(alerts)
      .where(eq(alerts.userId, session.user.id))
      .orderBy(desc(alerts.createdAt));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = crypto.randomUUID().slice(0, 12);
    const now = ts();

    await db.insert(alerts).values({
      id,
      userId: session.user.id,
      name: body.name,
      conditions: body.conditions ?? null,
      channels: body.channels ?? '["in_app"]',
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}
