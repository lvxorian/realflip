import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { calculatorPresets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: propertyId } = await params;

    const preset = await db
      .select()
      .from(calculatorPresets)
      .where(and(
        eq(calculatorPresets.propertyId, propertyId),
        eq(calculatorPresets.userId, session.user.id)
      ))
      .limit(1)
      .then((r) => r[0]);

    if (!preset) {
      return NextResponse.json({ preset: null });
    }

    return NextResponse.json({
      preset: {
        arv: preset.arv,
        renovationCost: preset.renovationCost,
        targetRoi: preset.targetRoi,
        config: preset.config ? JSON.parse(preset.config) : {},
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: propertyId } = await params;
    const body = await req.json();
    const now = ts();

    const existing = await db
      .select({ id: calculatorPresets.id })
      .from(calculatorPresets)
      .where(and(
        eq(calculatorPresets.propertyId, propertyId),
        eq(calculatorPresets.userId, session.user.id)
      ))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(calculatorPresets)
        .set({
          arv: body.arv ?? null,
          renovationCost: body.renovationCost ?? null,
          targetRoi: body.targetRoi ?? 15,
          config: body.config ? JSON.stringify(body.config) : "{}",
          updatedAt: now,
        })
        .where(eq(calculatorPresets.id, existing.id));
    } else {
      await db.insert(calculatorPresets).values({
        id: generateId(),
        propertyId,
        userId: session.user.id,
        arv: body.arv ?? null,
        renovationCost: body.renovationCost ?? null,
        targetRoi: body.targetRoi ?? 15,
        config: body.config ? JSON.stringify(body.config) : "{}",
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    const { id: propertyId } = await params;

    await db
      .delete(calculatorPresets)
      .where(and(
        eq(calculatorPresets.propertyId, propertyId),
        eq(calculatorPresets.userId, session.user.id)
      ));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
