import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { insolvencyEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeJsonParse, ts } from "@/lib/utils";
import { parsePdfFromUrl } from "@/lib/isir/apartment-parser";
import type { ApartmentData } from "@/lib/isir/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await db
    .select()
    .from(insolvencyEvents)
    .where(eq(insolvencyEvents.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const current = safeJsonParse<ApartmentData>(event.apartmentData, {
    address: null,
    disposition: null,
    area: null,
    cadastralArea: null,
    lvNumber: null,
    estimatedPrice: null,
    rawText: "",
  });

  if (current.rawText) {
    return NextResponse.json({ text: current.rawText, cached: true });
  }

  if (!event.documentUrl) {
    return NextResponse.json({ text: "", cached: true });
  }

  // Lazily pull and cache the embedded-document text so the detail view can
  // show it without re-parsing on every visit.
  const { text } = await parsePdfFromUrl(event.documentUrl);
  if (text) {
    await db
      .update(insolvencyEvents)
      .set({
        apartmentData: JSON.stringify({ ...current, rawText: text.slice(0, 4000) }),
        updatedAt: ts(),
      })
      .where(eq(insolvencyEvents.id, id));
    return NextResponse.json({ text, cached: false });
  }

  return NextResponse.json({ text: "", cached: true });
}
