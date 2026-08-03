import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts, safeJsonParse } from "@/lib/utils";

const DEFAULT_PREFS = {
  minRoi: 15,
  agentCommission: 5,
  legalFees: 25000,
  contingencyBuffer: 10,
  renovationCostPerSqm: { light: 4500, medium: 10000, full: 18000 },
};

// Neon ukládá jsonb (objekt), SQLite text (string) — normalizuje obě.
function parseReko(value: unknown): Record<string, number> {
  if (value == null) return {};
  if (typeof value === "object") return value as Record<string, number>;
  if (typeof value === "string") return safeJsonParse<Record<string, number>>(value, {});
  return {};
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1)
      .then((r) => r[0]);

    const reko = parseReko(row?.renovationCostPerSqm);
    return NextResponse.json({
      minRoi: row?.minRoi ?? DEFAULT_PREFS.minRoi,
      agentCommission: row?.agentCommission ?? DEFAULT_PREFS.agentCommission,
      legalFees: row?.legalFees ?? DEFAULT_PREFS.legalFees,
      contingencyBuffer: row?.contingencyBuffer ?? DEFAULT_PREFS.contingencyBuffer,
      renovationCostPerSqm: {
        light: reko.light ?? DEFAULT_PREFS.renovationCostPerSqm.light,
        medium: reko.medium ?? DEFAULT_PREFS.renovationCostPerSqm.medium,
        full: reko.full ?? DEFAULT_PREFS.renovationCostPerSqm.full,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const now = ts();
    const current = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1)
      .then((r) => r[0]);

    const reko = parseReko(current?.renovationCostPerSqm);
    const mergedReko = {
      light: body.renovationCostPerSqm?.light ?? reko.light ?? DEFAULT_PREFS.renovationCostPerSqm.light,
      medium: body.renovationCostPerSqm?.medium ?? reko.medium ?? DEFAULT_PREFS.renovationCostPerSqm.medium,
      full: body.renovationCostPerSqm?.full ?? reko.full ?? DEFAULT_PREFS.renovationCostPerSqm.full,
    };

    const values: Record<string, unknown> = {
      minRoi: body.minRoi ?? current?.minRoi ?? DEFAULT_PREFS.minRoi,
      agentCommission: body.agentCommission ?? current?.agentCommission ?? DEFAULT_PREFS.agentCommission,
      legalFees: body.legalFees ?? current?.legalFees ?? DEFAULT_PREFS.legalFees,
      contingencyBuffer: body.contingencyBuffer ?? current?.contingencyBuffer ?? DEFAULT_PREFS.contingencyBuffer,
      renovationCostPerSqm: JSON.stringify(mergedReko),
      updatedAt: now,
    };

    if (current) {
      await db.update(userPreferences).set(values).where(eq(userPreferences.userId, session.user.id));
    } else {
      await db.insert(userPreferences).values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        minRoi: values.minRoi as number,
        agentCommission: values.agentCommission as number,
        legalFees: values.legalFees as number,
        contingencyBuffer: values.contingencyBuffer as number,
        renovationCostPerSqm: values.renovationCostPerSqm as string,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
