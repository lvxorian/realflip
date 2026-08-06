import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { investors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkLoginRateLimit } from "@/lib/investor-portal";
import { setInvestorSession } from "@/lib/investor-session";
import { deriveInvestorCredentials } from "@/lib/investor-credentials";
import { recordInvestorLogin } from "@/lib/investor-activity-actions";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkLoginRateLimit(`login:${ip}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Příliš mnoho pokusů. Zkuste za ${Math.ceil(rate.retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Zadejte přihlašovací jméno a heslo." }, { status: 400 });
  }

  const enabledInvestors = await db
    .select()
    .from(investors)
    .where(eq(investors.portalEnabled, 1));

  const investor = enabledInvestors.find((i) => {
    const creds = deriveInvestorCredentials(i.name);
    return creds.username === username && creds.password === password;
  });

  if (!investor) {
    return NextResponse.json({ error: "Nesprávné přihlašovací údaje." }, { status: 401 });
  }

  await setInvestorSession(investor.id, investor.name);
  await recordInvestorLogin(investor.id);
  return NextResponse.json({ ok: true });
}
