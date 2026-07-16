import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return _client;
}

const SYSTEM_PROMPT = `Jsi expert na realitní vyjednávání v České republice, specializující se na flip strategii.
Tvým úkolem je vytvořit konkrétní vyjednávací scénář pro telefonát s majitelem nemovitosti.

PRAVIDLA:
- Cílem je koupit nemovitost co nejblíže "ideální kupní ceně" (targetPrice)
- Musíš znát aktuální cenu, ideální cenu, náklady na renovaci, ARV a ROI
- Argumenty musí být konkrétní a faktické (stav, lokalita, tržní srovnání)
- Nikdy nelhat, ale umět rámovat fakta ve svůj prospěch
- Respektovat české reálie a specifika jednotlivých lokalit

Výstup formátuj jako JSON:
{
  "phoneScript": "celý scénář hovoru krok za krokem (česky)",
  "openingLine": "první věta, kterou říct když majitel zvedne telefon",
  "arguments": ["konkrétní argument proč slevit", "další argument", "další"],
  "maxStartingOffer": "nejvyšší částka pro první nabídku (číslo v Kč)",
  "walkAwayPrice": "částka při které odejít (číslo v Kč)",
  "sellerMotivation": ["tip na odhalení motivace prodávajícího"],
  "handlingObjections": ["jak reagovat na námitky"],
  "keySellingPoints": ["co zdůraznit aby prodávající cítil že je to férová nabídka"]
}`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY není nastavena" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { title, description, price, targetPrice, arv, renovationCost, area, rooms, condition, address, pricePerSqm, costs } = body;

    const prompt = `Vytvoř vyjednávací scénář pro následující nemovitost:

INZERÁT: ${title}
AKTUÁLNÍ CENA: ${price?.toLocaleString()} Kč
IDEÁLNÍ KUPNÍ CENA: ${targetPrice?.toLocaleString()} Kč (nutné snížit o ${(price - targetPrice)?.toLocaleString()} Kč)
ARV (hodnota po rekonstrukci): ${arv?.toLocaleString()} Kč
NÁKLADY NA REKONSTRUKCI: ${renovationCost?.toLocaleString()} Kč
PLOCHA: ${area} m²
CENA ZA M²: ${pricePerSqm?.toLocaleString()} Kč/m²
DISPOZICE: ${rooms}
STAV: ${condition}
ADRESA: ${address}
POPIS: ${description?.slice(0, 1000)}

NÁKLADOVÝ ROZPIS:
- Provize RK: ${costs?.commission?.toLocaleString()} Kč
- Právní služby: ${costs?.legalFees?.toLocaleString()} Kč
- Znalecký posudek: ${costs?.appraisalFee?.toLocaleString()} Kč
- Holding (6 měsíců): ${costs?.holdingCosts?.toLocaleString()} Kč
- Provize při prodeji: ${costs?.sellingCommission?.toLocaleString()} Kč
- Home staging: ${costs?.homeStaging?.toLocaleString()} Kč
- Daň z příjmu: ${costs?.incomeTax?.toLocaleString()} Kč
CELKOVÉ NÁKLADY: ${costs?.totalCost?.toLocaleString()} Kč

Na základě těchto dat vytvoř vyjednávací scénář, který mi pomůže koupit nemovitost za ideální kupní cenu.`;

    const response = await getClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "user", parts: [{ text: prompt }] },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const text = response.text;
    if (!text) throw new Error("AI nevrátilo žádný text");

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error("Raw AI response:", text.slice(0, 500));
        throw new Error("AI nevrátilo validní JSON");
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Neznámá chyba";
    console.error("Negotiate API error:", msg);
    return NextResponse.json(
      { success: false, error: `Nepodařilo se vygenerovat scénář: ${msg}` },
      { status: 500 }
    );
  }
}
