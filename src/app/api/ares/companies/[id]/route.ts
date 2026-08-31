import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aresCompanies } from "@/db/schema";
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
  const company = await db
    .select()
    .from(aresCompanies)
    .where(eq(aresCompanies.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(company);
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

  if (body.pipeline !== undefined) updates.pipeline = body.pipeline;
  if (body.notesUser !== undefined) updates.notesUser = body.notesUser;
  if (body.score !== undefined) updates.score = body.score;

  if (body.pipeline === "contacted") {
    updates.contactedAt = ts();
  }

  await db
    .update(aresCompanies)
    .set(updates)
    .where(eq(aresCompanies.id, id));

  const updated = await db
    .select()
    .from(aresCompanies)
    .where(eq(aresCompanies.id, id))
    .limit(1)
    .then((r) => r[0]);

  return NextResponse.json(updated);
}
