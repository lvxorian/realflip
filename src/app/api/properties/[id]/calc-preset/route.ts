import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { calculatorPresets, propertyAnalysis } from "@/db/schema";
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
        mode: preset.mode ?? "flip",
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
          mode: body.mode === "rental" ? "rental" : "flip",
          config: JSON.stringify({ ...(body.costConfig || {}), rental: body.rental ?? null, renovationMode: body.renovationMode ?? null, renovationLevel: body.renovationLevel ?? null, renovationPerSqm: body.renovationPerSqm ?? null, renovationItems: body.renovationItems ?? null }),
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
        mode: body.mode === "rental" ? "rental" : "flip",
        config: JSON.stringify({ ...(body.costConfig || {}), rental: body.rental ?? null, renovationMode: body.renovationMode ?? null, renovationLevel: body.renovationLevel ?? null, renovationPerSqm: body.renovationPerSqm ?? null, renovationItems: body.renovationItems ?? null }),
        createdAt: now,
        updatedAt: now,
      });
    }

    // Ve výnosovém režimu propsat čistý výnos do property_analysis,
    // aby ho viděli konzumenti DB (report, call-mode, dashboard).
    if (body.mode === "rental" && typeof body.rentalNetYield === "number" && body.rentalNetYield > 0) {
      await db
        .update(propertyAnalysis)
        .set({ rentalYield: Math.round(body.rentalNetYield * 10) / 10, updatedAt: now })
        .where(eq(propertyAnalysis.propertyId, propertyId));
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
