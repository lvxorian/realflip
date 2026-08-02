import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computePriceIndex } from "@/lib/market/price-index";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const index = await computePriceIndex();
    return NextResponse.json(index);
  } catch (error) {
    console.error("Price index error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
