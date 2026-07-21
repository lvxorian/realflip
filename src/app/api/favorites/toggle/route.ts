import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { propertyId } = await req.json();
    if (!propertyId || typeof propertyId !== "string") {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, session.user.id),
          eq(favorites.propertyId, propertyId)
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      await db
        .delete(favorites)
        .where(
          and(
            eq(favorites.userId, session.user.id),
            eq(favorites.propertyId, propertyId)
          )
        );
      return NextResponse.json({ favorited: false });
    }

    await db.insert(favorites).values({
      userId: session.user.id,
      propertyId,
      createdAt: Date.now(),
    });

    return NextResponse.json({ favorited: true });
  } catch (error) {
    console.error("Favorites toggle error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
