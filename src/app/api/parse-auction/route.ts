import { NextResponse } from "next/server";
import { parseAuction } from "@/lib/auctions/parse-auction";

export const dynamic = "force-dynamic";

interface ParseAuctionRequest {
  url: string;
}

/**
 * 1-Click Due Diligence: vloží se odkaz na dražbu z portaldrazeb.cz a endpoint
 * vrátí strukturovaná data (OC, NP, název, adresa, exekutor, dlužník, fotky,
 * dokumenty) pro kalkulačku.
 *
 * Pipeline: JSON API detailu → PDF dokumenty (fallback při selhání) → LLM extrakce.
 */
export async function POST(req: Request) {
  let body: ParseAuctionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON tělo" }, { status: 400 });
  }

  const url = body?.url?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "Vložte odkaz na dražbu" }, { status: 400 });
  }
  if (!/^https?:\/\/[^/]*portaldrazeb\.cz\/(drazba|detail)\//i.test(url)) {
    return NextResponse.json(
      { error: "Vložte platný odkaz z portaldrazeb.cz (https://www.portaldrazeb.cz/drazba/...)" },
      { status: 400 }
    );
  }

  try {
    const result = await parseAuction(url);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("parse-auction error:", error);
    return NextResponse.json(
      {
        error:
          "Analýza dražby se nezdařila. Zkontrolujte odkaz, případně zkuste později.",
      },
      { status: 502 }
    );
  }
}
