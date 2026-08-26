import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchDocuments } from "@/lib/deska/edesky-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const keywords = searchParams.get("keywords");
    if (!keywords) {
      return NextResponse.json({ error: "keywords parameter is required" }, { status: 400 });
    }

    const dashboardId = searchParams.get("dashboardId") ?? undefined;
    const createdFrom = searchParams.get("createdFrom") ?? undefined;
    const searchWith = (searchParams.get("searchWith") as "es" | "sql") ?? "es";
    const order = (searchParams.get("order") as "date" | "score") ?? "date";
    const page = parseInt(searchParams.get("page") ?? "1", 10);

    const result = await searchDocuments({
      keywords,
      dashboardId,
      createdFrom,
      searchWith,
      order,
      page,
      includeTexts: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Deska search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
