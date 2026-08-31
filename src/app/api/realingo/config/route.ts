import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRealingoAccountConfig, saveRealingoAccountConfig } from "@/lib/realingo/sync";
import { db } from "@/db";
import { realingoAccount } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRealingoUser } from "@/lib/realingo/offers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = await getRealingoAccountConfig();
  const account = await db
    .select({
      lastSyncAt: realingoAccount.lastSyncAt,
      lastTotal: realingoAccount.lastTotal,
      lastLocked: realingoAccount.lastLocked,
      lastError: realingoAccount.lastError,
    })
    .from(realingoAccount)
    .where(eq(realingoAccount.id, "primary"))
    .limit(1)
    .then((r) => r[0]);

  const hasCredentials = Boolean(process.env.REALINGO_EMAIL && process.env.REALINGO_PASSWORD);

  let user = null;
  if (hasCredentials && cfg?.enabled) {
    user = await getRealingoUser().catch(() => null);
  }

  return NextResponse.json({
    config: cfg,
    syncState: account ?? null,
    hasCredentials,
    user,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const buildingStatuses = Array.isArray(body.buildingStatuses)
    ? body.buildingStatuses.map(String)
    : undefined;

  await saveRealingoAccountConfig({
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    address: typeof body.address === "string" ? body.address : undefined,
    purpose: typeof body.purpose === "string" ? body.purpose : undefined,
    property: typeof body.property === "string" ? body.property : undefined,
    buildingStatuses,
    sort: typeof body.sort === "string" ? body.sort : undefined,
    first: typeof body.first === "number" ? body.first : undefined,
    maxAge: typeof body.maxAge === "number" ? body.maxAge : undefined,
  });

  const cfg = await getRealingoAccountConfig();
  return NextResponse.json({ config: cfg });
}
