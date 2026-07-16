import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userPreferences, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const userId = session.user.id;

    const now = ts();
    await db
      .insert(userPreferences)
      .values({
        id: crypto.randomUUID(),
        userId,
        targetLocalities: body.targetLocalities || [],
        budgetMin: body.budgetMin || null,
        budgetMax: body.budgetMax || null,
        minRoi: body.minRoi || 15,
        propertyTypes: body.propertyTypes || [],
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          targetLocalities: body.targetLocalities || [],
          budgetMin: body.budgetMin || null,
          budgetMax: body.budgetMax || null,
          minRoi: body.minRoi || 15,
          propertyTypes: body.propertyTypes || [],
          updatedAt: now,
        },
      });

    // Mark onboarding as completed
    await db
      .update(users)
      .set({ onboardingCompleted: true })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
