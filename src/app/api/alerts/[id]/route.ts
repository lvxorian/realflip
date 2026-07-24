import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ts } from "@/lib/utils";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const allowed = ["name", "conditions", "rules", "channels", "isActive"];
    const update: Record<string, unknown> = { updatedAt: ts() };
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    await db
      .update(alerts)
      .set(update)
      .where(and(eq(alerts.id, id), eq(alerts.userId, session.user.id)));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await db
      .delete(alerts)
      .where(and(eq(alerts.id, id), eq(alerts.userId, session.user.id)));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
