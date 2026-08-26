import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { isirPolls } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polls = await db
    .select()
    .from(isirPolls)
    .orderBy(desc(isirPolls.startedAt))
    .limit(20);

  return NextResponse.json({ polls });
}
