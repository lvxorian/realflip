import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const all = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const unreadCount = all.filter((n) => !n.read).length;

    const items = all.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      data: n.data ? JSON.parse(n.data) : null,
      createdAt: n.createdAt,
    }));

    return NextResponse.json({ items, unreadCount });
  } catch {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }
}
