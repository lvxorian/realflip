import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { refreshLocalityCities } from "@/lib/locality";

export const dynamic = "force-dynamic";

export async function POST(_req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Města z aktivních nemovitostí
    const rows = await db
      .select({ city: propertyAnalysis.locationCity })
      .from(propertyAnalysis)
      .innerJoin(properties, eq(propertyAnalysis.propertyId, properties.id))
      .where(and(eq(properties.isActive, 1)));

    const cityKeys = [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c))];
    const { ok, failed } = await refreshLocalityCities(cityKeys);

    return NextResponse.json({ ok, failed, cities: cityKeys.length });
  } catch (error) {
    console.error("Locality refresh error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
