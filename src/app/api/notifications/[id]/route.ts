import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));
  return NextResponse.json({ ok: true });
}
