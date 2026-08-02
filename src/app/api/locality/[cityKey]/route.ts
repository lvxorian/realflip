import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLocalityForProperty } from "@/lib/locality";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cityKey: string; district?: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cityKey } = await params;
    if (!cityKey) {
      return NextResponse.json({ error: "cityKey required" }, { status: 400 });
    }

    const summary = await getLocalityForProperty({
      cityKey: decodeURIComponent(cityKey),
      district: null,
      lat: null,
      lng: null,
    });

    if (!summary) {
      return NextResponse.json({ locality: null });
    }

    return NextResponse.json({ locality: summary });
  } catch (error) {
    console.error("Locality fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
