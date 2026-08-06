import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { investors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { checkLoginRateLimit } from "@/lib/investor-portal";
import { setInvestorSession } from "@/lib/investor-session";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkLoginRateLimit(`login:${ip}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Příliš mnoho pokusů. Zkuste za ${Math.ceil(rate.retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  let body: { name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const password = typeof body.password === "string" ? body.password : "";
  if (!name || !password) {
    return NextResponse.json({ error: "Zadejte jméno a heslo." }, { status: 400 });
  }

  const investorsList = await db
    .select()
    .from(investors)
    .where(eq(investors.name, name))
    .limit(1);

  const investor = investorsList[0];
  const enabled = investor && (investor.portalEnabled ?? 0) === 1;
  const valid =
    investor &&
    enabled &&
    !!investor.portalPasswordHash &&
    (await compare(password, investor.portalPasswordHash));

  if (!valid) {
    return NextResponse.json({ error: "Nesprávné přihlašovací údaje." }, { status: 401 });
  }

  await setInvestorSession(investor!.id, investor!.name ?? name);
  return NextResponse.json({ ok: true });
}