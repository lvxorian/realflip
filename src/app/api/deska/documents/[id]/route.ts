import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { deskaDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await db
    .select()
    .from(deskaDocuments)
    .where(eq(deskaDocuments.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mark as read
  if (!doc.isRead) {
    await db
      .update(deskaDocuments)
      .set({ isRead: 1 })
      .where(eq(deskaDocuments.id, id));
  }

  return NextResponse.json(doc);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if ("notes" in body) updates.notes = body.notes;
  if ("isArchived" in body) updates.isArchived = body.isArchived ? 1 : 0;
  if ("isRead" in body) updates.isRead = body.isRead ? 1 : 0;
  if ("address" in body) updates.address = body.address;
  if ("lat" in body) updates.lat = body.lat;
  if ("lng" in body) updates.lng = body.lng;
  if ("leadId" in body) updates.leadId = body.leadId;
  if ("propertyId" in body) updates.propertyId = body.propertyId;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  await db.update(deskaDocuments).set(updates).where(eq(deskaDocuments.id, id));

  return NextResponse.json({ ok: true });
}
