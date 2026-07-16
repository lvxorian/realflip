import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

interface NegotiateInput {
  title: string;
  description: string | null;
  price: number;
  targetPrice: number;
  arv: number;
  renovationCost: number;
  area: number | null;
  rooms: string | null;
  condition: string | null;
  address: string | null;
  pricePerSqm: number | null;
  costs: {
    commission: number;
    legalFees: number;
    appraisalFee: number;
    renovationCost: number;
    contingency: number;
    holdingCosts: number;
    sellingCommission: number;
    marketingPhoto: number;
    furnishing: number;
    energyCert: number;
    incomeTax: number;
    totalCost: number;
  };
}

function generateFallback(data: NegotiateInput) {
  const { price, targetPrice, arv, renovationCost, area, condition, address, costs } = data;
  const reduction = price - targetPrice;
  const reductionPct = price > 0 ? Math.round((reduction / price) * 100) : 0;
  const areaStr = area ? `${area} m²` : "";

  let conditionArg = "";
  if (condition === "original" || condition === "dilapidated") {
    conditionArg = `Nemovitost je v ${condition === "dilapidated" ? "zchátralém" : "původním"} stavu, rekonstrukce vyjde na ${formatPrice(renovationCost)}. To už je skoro ${reductionPct} % z ceny.`;
  } else if (condition === "good") {
    conditionArg = `I když je stav dobrý, počkej mě rekonstrukce za ${formatPrice(renovationCost)} (podlahy, koupelna, kuchyně).`;
  } else if (condition === "renovated") {
    conditionArg = `Byt vypadá dobře, ale i tak počítám s ${formatPrice(renovationCost)} na drobné úpravy a zařízení.`;
  }

  const locationArg = address
    ? `V lokalitě ${address} se podobné byty prodávají za ceny kolem ${formatPrice(arv - Math.round(arv * 0.1))}–${formatPrice(arv)} po rekonstrukci. Vaše cena ${formatPrice(price)} je ${reductionPct} % nad tím, co dává smysl pro investici.`
    : "";

  const costBreakdown = `Když to spočítám: kupní cena ${formatPrice(price)} + rekonstrukce ${formatPrice(renovationCost)} + provize a poplatky ${formatPrice(costs.totalCost - price - renovationCost)} = celkové náklady ${formatPrice(costs.totalCost)}. Při prodeji za ${formatPrice(arv)} mi zbývá jen ${formatPrice(arv - costs.totalCost)} marže, což při dnešních úrokových sazbách není zajímavé.`;

  const firstOfferPrice = Math.round(targetPrice * 0.92);
  const walkAwayPrice = Math.round(targetPrice * 1.08);

  const argue = [
    `Stav nemovitosti: ${conditionArg}`,
    locationArg,
    costBreakdown,
    `Pro srovnání — podobné byty v okolí se nabízejí za ${formatPrice(arv - Math.round(arv * 0.15))}–${formatPrice(arv)}. Vaše cena je o ${formatPrice(reduction)} výš.`,
  ].filter(Boolean);

  const objections = [
    "Mám ještě další zájemce → Chápu, ale já můžu nabídnout jistotu — mám finance připravené, nepotřebuji hypotéku, můžeme podepsat do 14 dnů.",
    "Cena je konečná → Respektuji, ale pojďme se podívat na čísla. Rekonstrukce vyjde na X, po započtení všech nákladů mi vychází marže Y %. Potřebujeme se dostat na částku, která dává smysl pro obě strany.",
    "Už jsem snížil cenu → Vidím to, ale bohužel i po snížení je to nad trhem. Pojďme najít částku, při které se bavíme o reálném prodeji.",
  ];

  const motivationTips = [
    "Zeptej se: 'Proč se rozhodujete prodávat právě teď?' — odpověď odhalí motivaci (dědicví, rozvod, stěhování, exekuce).",
    "Pokud je byt prázdný → majitel platí energie a daň z nemovitosti zbytečně. To je tvoje páka.",
    "Zjisti jestli už majitel něco koupil nebo řeší hypotéku — časový tlak = lepší pozice pro tebe.",
    "Dlouho v inzerci (více než 3 měsíce) = majitel je unavený, připravený slevit.",
  ];

  const phoneScript = `1. ÚVOD
"Dobrý den, jmenuji se [TVÉ JMÉNO]. Volám ohledně vašeho inzerátu na prodej bytu v ${address ?? "lokalitě"}. Viděl jsem nabídku a chtěl bych probrat možnost koupě."

2. PRVNÍ DOJEM
"Byt vypadá hezky, ale mám za sebou pár propočtů a rád bych je s vámi sdílel, abychom zjistili, jestli se můžeme domluvit."

3. ARGUMENTACE
- ${argue[0]}
- ${argue[1] ?? ""}
- ${argue[2]}

4. NABÍDKA
"Jsem připravený nabídnout ${formatPrice(firstOfferPrice)} Kč a můžeme podepsat do 14 dnů — mám finance připravené."

5. REAKCE NA NÁMITKY
- Pokud řekne že je cena konečná: "${objections[1]}"
- Pokud zmíní jiné zájemce: "${objections[0]}"

6. ZÁVĚR
"Moje finální nabídka je ${formatPrice(Math.round(targetPrice))} Kč. Promyslete si to, můžeme se bavit dál. Děkuji za váš čas."`;

  return {
    phoneScript,
    openingLine: `Dobrý den, volám ohledně vašeho inzerátu na prodej bytu v ${address ?? "lokalitě"}. Mám zájem, ale rád bych probral pár čísel — myslím, že se můžeme domluvit.`,
    arguments: argue,
    maxStartingOffer: firstOfferPrice,
    walkAwayPrice,
    sellerMotivation: motivationTips,
    handlingObjections: objections,
    keySellingPoints: [
      "Mám hotovost — žádná hypotéka, žádné riziko nedofinancování",
      "Dokážeme podepsat do 14 dnů",
      "Žádná provize pro RK — šetříte 4 %",
      "Jako investor kupuji více nemovitostí — můžeme spolupracovat dlouhodobě",
    ],
  };
}

async function generateWithAI(data: NegotiateInput) {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  const { title, description, price, targetPrice, arv, renovationCost, area, rooms, condition, address, pricePerSqm, costs } = data;

  const prompt = `Vytvoř vyjednávací scénář pro následující nemovitost:

INZERÁT: ${title}
AKTUÁLNÍ CENA: ${price?.toLocaleString()} Kč
IDEÁLNÍ KUPNÍ CENA: ${targetPrice?.toLocaleString()} Kč (nutné snížit o ${(price - targetPrice)?.toLocaleString()} Kč)
ARV: ${arv?.toLocaleString()} Kč
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
- Rekonstrukce: ${costs?.renovationCost?.toLocaleString()} Kč
- Rezerva 10 %: ${costs?.contingency?.toLocaleString()} Kč
- Holding: ${costs?.holdingCosts?.toLocaleString()} Kč
- Provize při prodeji: ${costs?.sellingCommission?.toLocaleString()} Kč
- Marketing + foto: ${costs?.marketingPhoto?.toLocaleString()} Kč
- Zařízení bytu: ${costs?.furnishing?.toLocaleString()} Kč
- Daň z příjmu: ${costs?.incomeTax?.toLocaleString()} Kč
CELKOVÉ NÁKLADY: ${costs?.totalCost?.toLocaleString()} Kč

Odpověz jako JSON:
{
  "phoneScript": "celý scénář hovoru krok za krokem česky",
  "openingLine": "první věta",
  "arguments": ["argument1", "argument2"],
  "maxStartingOffer": číslo,
  "walkAwayPrice": číslo,
  "sellerMotivation": ["tip1", "tip2"],
  "handlingObjections": ["reakce1", "reakce2"],
  "keySellingPoints": ["bod1", "bod2"]
}`;

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: "Jsi expert na realitní vyjednávání v ČR. Odpovídej vždy česky. Výstup formátuj striktně jako JSON." }] },
      { role: "user", parts: [{ text: prompt }] },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const text = response.text;
  if (!text) throw new Error("AI nevrátilo text");

  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI nevrátilo validní JSON");
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: NegotiateInput = await req.json();

    if (process.env.GEMINI_API_KEY) {
      try {
        const aiResult = await generateWithAI(body);
        return NextResponse.json({ success: true, ...aiResult });
      } catch (e) {
        console.error("AI negotiate failed, using fallback:", e);
      }
    }

    const fallback = generateFallback(body);
    return NextResponse.json({ success: true, ...fallback });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Neznámá chyba";
    console.error("Negotiate error:", msg);
    return NextResponse.json(
      { success: false, error: `Chyba: ${msg}` },
      { status: 500 }
    );
  }
}
