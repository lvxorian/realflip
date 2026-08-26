import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { deskaDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dashboardId = searchParams.get("dashboardId");
  if (!dashboardId) {
    return NextResponse.json({ error: "dashboardId is required" }, { status: 400 });
  }

  const docs = await db
    .select()
    .from(deskaDocuments)
    .where(eq(deskaDocuments.dashboardId, dashboardId))
    .limit(20);

  const summary = {
    total: docs.length,
    byCategory: docs.reduce(
      (acc, doc) => {
        acc[doc.category] = (acc[doc.category] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    recent: docs.slice(0, 5),
  };

  return NextResponse.json(summary);
}
