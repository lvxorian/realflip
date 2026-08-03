import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { investors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts } from "@/lib/utils";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const investor = await db
      .select()
      .from(investors)
      .where(eq(investors.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    return NextResponse.json(investor);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Jméno investora je povinné" }, { status: 400 });
    }

    const patch: Record<string, string | number | null> = { updatedAt: ts() };
    if (name !== undefined) patch.name = name;
    if (typeof body.city === "string") patch.city = body.city.trim() || null;
    if (typeof body.phone === "string") patch.phone = body.phone.trim() || null;
    if (typeof body.email === "string") patch.email = body.email.trim() || null;
    if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
    if (typeof body.budget === "number" && body.budget >= 0) patch.budget = Math.round(body.budget);
    if (body.budgetUnlimited !== undefined) patch.budgetUnlimited = body.budgetUnlimited ? 1 : 0;

    await db.update(investors).set(patch).where(eq(investors.id, id));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(investors).where(eq(investors.id, id));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
