import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { offMarketRegions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECRET_TOKEN = process.env.OFF_MARKET_API_TOKEN;

async function verifyBearerOrSession(req: Request) {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (bearer && bearer === SECRET_TOKEN) return null;
  const session = await auth();
  if (session?.user?.id) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const authErr = await verifyBearerOrSession(req);
  if (authErr) return authErr;

  try {
    const rows = await db
      .select({ region: offMarketRegions.region })
      .from(offMarketRegions)
      .orderBy(offMarketRegions.region);

    return NextResponse.json(rows.map((r) => r.region));
  } catch (error) {
    console.error("Off-market regions GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { region } = await req.json();
    if (!region || typeof region !== "string") {
      return NextResponse.json({ error: "Region is required" }, { status: 400 });
    }

    const slug = region.trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    const existing = await db
      .select({ id: offMarketRegions.id })
      .from(offMarketRegions)
      .where(eq(offMarketRegions.region, slug))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return NextResponse.json({ error: "Region already exists" }, { status: 409 });
    }

    await db.insert(offMarketRegions).values({
      id: generateId(),
      region: slug,
      createdAt: ts(),
    });

    return NextResponse.json({ region: slug }, { status: 201 });
  } catch (error) {
    console.error("Off-market regions POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");

    if (!region) {
      return NextResponse.json({ error: "Region query param is required" }, { status: 400 });
    }

    await db
      .delete(offMarketRegions)
      .where(eq(offMarketRegions.region, region));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Off-market regions DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
