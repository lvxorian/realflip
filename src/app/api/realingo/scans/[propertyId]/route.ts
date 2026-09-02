import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, realingoScans } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import {
  createScanFromOffer,
  getScan,
  getScanComparables,
  waitForScan,
  type RealingoComparable,
} from "@/lib/realingo/realscan";
import type { RealingoScanStatus } from "@/lib/realingo/types";

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

const RUNNING_STATUSES = new Set(["PENDING", "RUNNING", "QUEUED", "PROCESSING", "CREATED"]);
const FAILED_STATUSES = new Set(["FAILED", "ERROR", "CANCELED", "CANCELLED"]);

function isRunning(status: string | null | undefined): boolean {
  return status != null && RUNNING_STATUSES.has(status.toUpperCase());
}

function serialize(scan: {
  id: string;
  scanId: string | null;
  status: string | null;
  resultJson: unknown;
  priceIndexJson: unknown;
  comparablesJson: unknown;
  createdAt: number;
}) {
  return {
    id: scan.id,
    scanId: scan.scanId,
    status: scan.status,
    result: parseJson(scan.resultJson as string | null, null),
    priceIndex: parseJson(scan.priceIndexJson as string | null, []),
    hasComparables: Boolean(scan.comparablesJson),
    createdAt: scan.createdAt,
  };
}

async function persistScanResult(scanRowId: string, status: RealingoScanStatus | null, comparables?: RealingoComparable[]) {
  await db
    .update(realingoScans)
    .set({
      status: status?.status ?? null,
      resultJson: JSON.stringify(status?.result ?? null),
      priceIndexJson: JSON.stringify(status?.priceIndex ?? []),
      ...(comparables ? { comparablesJson: JSON.stringify(comparables) } : {}),
      updatedAt: ts(),
    })
    .where(eq(realingoScans.id, scanRowId));
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

  // Lazy refresh: rozdělané scany dotáhneme z Realinga (denní sync je
  // nedokončí — počítají se minuty a jen GET sem chodí opakovaně z panelu).
  const pending = scans.filter((s) => s.scanId && isRunning(s.status));
  if (pending.length > 0) {
    await Promise.all(
      pending.map(async (row) => {
        try {
          const fresh = await getScan(row.scanId!);
          if (fresh) await persistScanResult(row.id, fresh);
        } catch (e) {
          console.warn("[Realingo] scan refresh failed:", row.scanId, e);
        }
      })
    );
    for (const row of pending) {
      const fresh = await db
        .select()
        .from(realingoScans)
        .where(eq(realingoScans.id, row.id))
        .limit(1)
        .then((r) => r[0]);
      if (fresh) Object.assign(row, fresh);
    }
  }

  return NextResponse.json({ scans: scans.map(serialize) });
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
      { error: "Tato nemovitost pochází z jiného zdroje — RealScan vyžaduje Realingo nabídku." },
      { status: 400 }
    );
  }

  try {
    // 1) Neběhující už existující scan? Nemytrovat nový — každý scan žere kredit.
    const existing = await db
      .select()
      .from(realingoScans)
      .where(and(eq(realingoScans.propertyId, propertyId), inArray(realingoScans.status, [...RUNNING_STATUSES])))
      .limit(1)
      .then((r) => r[0]);

    if (existing?.scanId) {
      const fresh = await getScan(existing.scanId).catch(() => null);
      if (fresh) await persistScanResult(existing.id, fresh);
      const row = fresh ? { ...existing, status: fresh.status, resultJson: JSON.stringify(fresh.result ?? null), priceIndexJson: JSON.stringify(fresh.priceIndex ?? []) } : existing;
      return NextResponse.json({
        ...serialize(row),
        reused: true,
        running: isRunning(fresh?.status ?? existing.status),
      });
    }

    // 2) Nový scan: vytvořit a dočkat se dokončení (Realingo počítá ~10-60 s).
    const created = await createScanFromOffer(prop.realingoId);
    if (!created?.id) {
      return NextResponse.json({ error: "RealScan se nepodařilo vytvořit." }, { status: 502 });
    }

    let comparables: RealingoComparable[] = [];
    let final: RealingoScanStatus = created;
    try {
      final = await waitForScan(created.id, { timeoutMs: 50_000, intervalMs: 4_000 });
      if (!isRunning(final.status)) {
        comparables = await getScanComparables(final.id).catch(() => []);
      }
    } catch (e) {
      console.error("[Realingo] waitForScan failed:", e);
    }

    const recordId = generateId();
    const now = ts();
    await db.insert(realingoScans).values({
      id: recordId,
      propertyId: prop.id,
      offerId: prop.realingoId,
      scanId: final.id,
      status: final.status ?? "PENDING",
      resultJson: JSON.stringify(final.result ?? null),
      priceIndexJson: JSON.stringify(final.priceIndex ?? []),
      comparablesJson: comparables.length ? JSON.stringify(comparables) : null,
      createdAt: now,
      updatedAt: now,
    });

    const finished = !isRunning(final.status);
    return NextResponse.json({
      id: recordId,
      scanId: final.id,
      status: final.status,
      result: final.result,
      priceIndex: final.priceIndex ?? [],
      comparables,
      reused: false,
      running: !finished,
      failed: FAILED_STATUSES.has((final.status ?? "").toUpperCase()),
    });
  } catch (error) {
    console.error("[Realingo] Scan error:", error);
    return NextResponse.json(
      { error: "RealScan se nepodařilo zpracovat. Zkuste to prosím později." },
      { status: 502 }
    );
  }
}
