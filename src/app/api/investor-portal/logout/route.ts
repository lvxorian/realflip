import { NextResponse } from "next/server";
import { clearInvestorSession } from "@/lib/investor-session";

export async function POST() {
  await clearInvestorSession();
  return NextResponse.json({ ok: true });
}