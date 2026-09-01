import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { vykupyLeads } from "@/db/schema";
import { type SQL, eq, and, or, like, desc, sql } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { digestEquals } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// Fail-closed: bez nastaveného tokenu neprojde nic (dřív nechal POST projít
// bez hlavičky, když VYKUPY_API_TOKEN není nastavené — undefined === undefined).
async function verifyBearer(req: Request) {
  const expected = process.env.VYKUPY_API_TOKEN;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!expected || !token || !digestEquals(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const authErr = await verifyBearer(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Expected array of leads" }, { status: 400 });
    }

    let inserted = 0;
    let skipped = 0;
    const now = ts();

    for (const item of body) {
      if (!item.caseNumber || !item.debtorName) continue;

      const existing = await db
        .select({ id: vykupyLeads.id })
        .from(vykupyLeads)
        .where(eq(vykupyLeads.caseNumber, item.caseNumber))
        .limit(1)
        .then((r) => r[0]);

      if (existing) {
        // Update address/region if they were NULL before
        const updates: Record<string, unknown> = { updatedAt: ts() };
        if (item.address) updates.address = item.address;
        if (item.region) updates.region = item.region;
        updates.rawData = JSON.stringify(item.rawData ?? {});
        await db
          .update(vykupyLeads)
          .set(updates)
          .where(eq(vykupyLeads.caseNumber, item.caseNumber));
        skipped++;
        continue;
      }

      await db.insert(vykupyLeads).values({
        id: generateId(),
        debtorName: item.debtorName,
        caseNumber: item.caseNumber,
        address: item.address ?? null,
        region: item.region ?? null,
        status: "NEW",
        rawData: JSON.stringify(item.rawData ?? {}),
        notes: null,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }

    return NextResponse.json({ inserted, skipped });
  } catch (error) {
    console.error("Off-market POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const region = searchParams.get("region");
    const search = searchParams.get("search");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (status) conditions.push(eq(vykupyLeads.status, status));
    if (region) conditions.push(eq(vykupyLeads.region, region));
    if (search) {
      const q = `%${search}%`;
      const searchCond = or(
        like(vykupyLeads.debtorName, q),
        like(vykupyLeads.caseNumber, q),
        like(vykupyLeads.address, q),
      );
      if (searchCond) conditions.push(searchCond);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [leads, countResult] = await Promise.all([
      db
        .select()
        .from(vykupyLeads)
        .where(where)
        .orderBy(desc(vykupyLeads.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(vykupyLeads)
        .where(where)
        .then((r) => r[0].count),
    ]);

    return NextResponse.json({ leads, total: countResult });
  } catch (error) {
    console.error("Off-market GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
