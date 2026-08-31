import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aresPolls } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polls = await db
    .select()
    .from(aresPolls)
    .orderBy(desc(aresPolls.startedAt))
    .limit(20);

  return NextResponse.json({ polls });
}
