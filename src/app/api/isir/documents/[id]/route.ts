import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { insolvencyEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await db
    .select()
    .from(insolvencyEvents)
    .where(eq(insolvencyEvents.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updatedAt: ts() };

  if (body.status !== undefined) updates.status = body.status;
  if (body.notesUser !== undefined) updates.notesUser = body.notesUser;
  if (body.score !== undefined) updates.score = body.score;

  if (body.status === "contacted") {
    updates.contactedAt = ts();
  }

  await db
    .update(insolvencyEvents)
    .set(updates)
    .where(eq(insolvencyEvents.id, id));

  const updated = await db
    .select()
    .from(insolvencyEvents)
    .where(eq(insolvencyEvents.id, id))
    .limit(1)
    .then((r) => r[0]);

  return NextResponse.json(updated);
}
