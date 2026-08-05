import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PRIORITIES = ["low", "medium", "high"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, session.user.id))
      .orderBy(
        sql`${tasks.done} ASC`,
        sql`CASE ${tasks.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC`,
        sql`${tasks.dueAt} ASC NULLS LAST`,
        sql`${tasks.createdAt} DESC`
      );
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const priority = PRIORITIES.includes(body.priority) ? body.priority : "medium";
    const dueAt =
      typeof body.dueAt === "number" && Number.isFinite(body.dueAt) ? body.dueAt : null;

    const id = generateId();
    const now = ts();
    await db.insert(tasks).values({
      id,
      userId: session.user.id,
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      dueAt,
      priority,
      done: 0,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .then((r) => r[0]);

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}