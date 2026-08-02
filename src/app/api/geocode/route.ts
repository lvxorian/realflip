import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { geocodeAddress } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * Geokóduje adresu přes OSM Nominatim a uloží souřadnice do properties (cache).
 * Input: { address?, cityKey?, propertyId? } — propertyId je volitelný pro persistenci.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { address, cityKey, propertyId } = body;

    if (!address && !cityKey) {
      return NextResponse.json({ error: "address or cityKey required" }, { status: 400 });
    }

    const result = await geocodeAddress(address ?? null, cityKey ?? null);

    // Uložit do DB (jednorázová cache — příště má nemovitost GPS)
    if (propertyId && result.lat != null && result.lng != null) {
      try {
        await db
          .update(properties)
          .set({ lat: result.lat, lng: result.lng })
          .where(eq(properties.id, propertyId));
      } catch (e) {
        console.error("Geocode persist failed:", e);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Geocode error:", error);
    return NextResponse.json({ lat: null, lng: null, displayName: null, source: null }, { status: 200 });
  }
}
