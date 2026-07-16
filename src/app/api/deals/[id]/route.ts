import { NextResponse } from "next/server";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

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
    await db.delete(deals).where(eq(deals.id, id));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
