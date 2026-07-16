import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(contacts)
      .orderBy(desc(contacts.createdAt));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
