import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { investors } from "@/db/schema";
import { desc } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { deriveInvestorCredentials } from "@/lib/investor-credentials";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.select().from(investors).orderBy(desc(investors.createdAt));
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Jméno investora je povinné" }, { status: 400 });
    }

    const budget = typeof body.budget === "number" && body.budget >= 0 ? Math.round(body.budget) : null;
    const budgetUnlimited = body.budgetUnlimited ? 1 : 0;
    const portalEnabled = body.portalEnabled ? 1 : 0;
    if (portalEnabled && !deriveInvestorCredentials(name).password) {
      return NextResponse.json({ error: "Pro přístup k portálu zadejte jméno i příjmení investora" }, { status: 400 });
    }
    const now = ts();

    const id = generateId();
    await db.insert(investors).values({
      id,
      name,
      city: typeof body.city === "string" && body.city.trim() ? body.city.trim() : null,
      phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
      email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
      budget,
      budgetUnlimited,
      portalEnabled,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id, name, city: null, phone: null, email: null, budget, budgetUnlimited, portalEnabled, notes: null, createdAt: now, updatedAt: now }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
