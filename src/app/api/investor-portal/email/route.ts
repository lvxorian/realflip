import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { investors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getInvestorSession } from "@/lib/investor-session";
import { normalizeEmail } from "@/lib/email/validate";
import { touchInvestorActivity } from "@/lib/investor-activity-actions";

export async function POST(req: NextRequest) {
  const session = await getInvestorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await touchInvestorActivity(session.sub);

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Zadejte platnou e-mailovou adresu." }, { status: 400 });
  }

  await db
    .update(investors)
    .set({ email, updatedAt: Date.now() })
    .where(eq(investors.id, session.sub));

  return NextResponse.json({ ok: true, email });
}