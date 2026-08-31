import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, realingoScans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import {
  createScanFromOffer,
  getScanComparables,
  type RealingoComparable,
} from "@/lib/realingo/realscan";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** Jsonb (PG) vrací objekt, text (SQLite) řetězec — sjednotí na objekt. */
function parseJson(value: string | unknown | null, fallback: unknown): unknown {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { propertyId } = await params;

  const scans = await db
    .select()
    .from(realingoScans)
    .where(eq(realingoScans.propertyId, propertyId))
    .orderBy(desc(realingoScans.createdAt))
    .limit(20);

  return NextResponse.json({
    scans: scans.map((s) => ({
      id: s.id,
      scanId: s.scanId,
      status: s.status,
      result: parseJson(s.resultJson, null),
      priceIndex: parseJson(s.priceIndexJson, []),
      hasComparables: Boolean(s.comparablesJson),
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { propertyId } = await params;

  const prop = await db
    .select({ id: properties.id, realingoId: properties.realingoId, title: properties.title })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1)
    .then((r) => r[0]);

  if (!prop) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (!prop.realingoId) {
    return NextResponse.json(
      { error: "Tato nemovitost pochází z jiného zdroje — RealScan vyžaduje Realingo nabídku. Zapněte Realingo sync a přerestujte." },
      { status: 400 }
    );
  }

  try {
    const created = await createScanFromOffer(prop.realingoId);
    if (!created?.id) {
      return NextResponse.json({ error: "RealScan se nepodařilo vytvořit." }, { status: 502 });
    }

    let comparables: RealingoComparable[] = [];
    try {
      comparables = await getScanComparables(created.id);
    } catch {
      comparables = [];
    }

    const recordId = generateId();
    const now = ts();
    await db.insert(realingoScans).values({
      id: recordId,
      propertyId: prop.id,
      offerId: prop.realingoId,
      scanId: created.id,
      status: created.status ?? "PENDING",
      resultJson: JSON.stringify(created.result),
      priceIndexJson: JSON.stringify(created.priceIndex ?? []),
      comparablesJson: JSON.stringify(comparables),
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      scanId: created.id,
      status: created.status,
      result: created.result,
      priceIndex: created.priceIndex,
      comparables,
      recordId,
    });
  } catch (error) {
    console.error("[Realingo] Scan error:", error);
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
