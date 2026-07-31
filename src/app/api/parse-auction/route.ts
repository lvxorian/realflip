import { NextResponse } from "next/server";
import { delay } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ParseAuctionRequest {
  url: string;
}

/**
 * 1-Click Due Diligence: vloží se odkaz na dražbu z portaldrazeb.cz a endpoint
 * vrátí strukturovaná data (OC, NP, název, adresa, dokumenty) pro kalkulačku.
 *
 * AKTUÁLNÍ STAV: MOCK. Po 2 sekundách vrací vzorová data, aby UI mělo
 * reálné loading a schéma odpovědi.
 *
 * PRODUKČNÍ NASAZENÍ (kostra připravena v src/lib/auctions/parse-auction.ts):
 * 1. Zavolat parseAuction(url) – serverově stáhne HTML detailu,
 * 2. najde PDF (Dražební vyhláška + Znalecký posudek) a stáhne je,
 * 3. LLM extrakce (gemini-2.5-flash, nativní OCR) vrátí ParsedAuction,
 * 4. odsud se odpoví stejným JSON tvarem – klient se nemění.
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
  if (!/^https?:\/\/[^/]*portaldrazeb\.cz\//i.test(url)) {
    return NextResponse.json(
      { error: "Vložte platný odkaz z portaldrazeb.cz (https://www.portaldrazeb.cz/detail/...)" },
      { status: 400 }
    );
  }

  // Simulace reálné analýzy (stahování PDF + LLM extraction)
  await delay(2000);

  return NextResponse.json({
    success: true,
    sourceUrl: url,
    parsed: {
      title: "Dražba – bytová jednotka 2+1, ul. Na Výsluní 12, Brno-Královo Pole",
      address: "Na Výsluní 1055/12, 612 00 Brno-Královo Pole",
      appraisalPrice: 3_850_000, // OC – odhadní cena ze znaleckého posudku
      minimumBid: 2_695_000, // NP – nejnižší podání (70 % OC)
      auctionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      documents: [
        {
          type: "vyhlaska",
          url: "https://www.portaldrazeb.cz/dokumenty/drazebni-vyhlaska/123456",
        },
        {
          type: "posudek",
          url: "https://www.portaldrazeb.cz/dokumenty/znalecky-posudek/123456",
        },
      ],
    },
  });
}
