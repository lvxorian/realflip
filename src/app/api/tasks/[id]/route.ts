import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PRIORITIES = ["low", "medium", "high"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const update: Record<string, unknown> = { updatedAt: ts() };

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      update.title = title;
    }
    if (typeof body.description === "string") {
      update.description = body.description.trim() || null;
    }
    if (typeof body.dueAt === "number" && Number.isFinite(body.dueAt)) {
      update.dueAt = body.dueAt;
    }
    if (body.dueAt === null) {
      update.dueAt = null;
    }
    if (PRIORITIES.includes(body.priority)) {
      update.priority = body.priority;
    }
    if (typeof body.done === "number") {
      update.done = body.done ? 1 : 0;
    }

    await db
      .update(tasks)
      .set(update)
      .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}