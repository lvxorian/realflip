import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalConfig, upsertPortalConfig } from "@/lib/portal-config";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await getPortalConfig());
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
    if (typeof body.fiftyFiftyEnabled !== "boolean") {
      return NextResponse.json({ error: "Chybí hodnota fiftyFiftyEnabled" }, { status: 400 });
    }
    const notice = typeof body.fiftyFiftyNotice === "string" ? body.fiftyFiftyNotice.slice(0, 300) : undefined;
    return NextResponse.json(await upsertPortalConfig({ fiftyFiftyEnabled: body.fiftyFiftyEnabled, fiftyFiftyNotice: notice }));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}