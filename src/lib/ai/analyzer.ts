import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return _client;
}

interface AiAnalysisInput {
  title: string;
  description: string;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  rooms: string | null;
  address: string | null;
  condition: string | null;
}

interface AiAnalysisResult {
  summary: string;
  sentiment: "urgent" | "neutral" | "slow";
  maxBid: number;
  negotiationTips: string[];
  redFlags: string[];
  hiddenInfo: string[];
  comparableNotes: string;
}

interface DealAnalysisResult {
  condition: string | null;
  urgency: string | null;
  motivation: string | null;
}

const SYSTEM_PROMPT = `Jsi expert na realitní investice v České republice specializující se na flip strategii (koupě, renovace, prodej). Máš hluboké znalosti českého realitního trhu, cen v jednotlivých městech a lokalitách, a typických nákladů na renovaci.

PRAVIDLA ANALÝZY:

1. CÍLOVÁ MARŽE: Flip je ziskový při konzervativní ROI ≥ 15 %. Cílový target ROI je přesně 15 %.

2. LOKALITY (kategorie ovlivňují prodejní strop):
   - Premium: Vinohrady, Karlín, Dejvice, Staré Město, Malá Strana, Letná, Bubeneč, Královo Pole, Veveří, centra krajských měst
   - Stable: většina širších center, sídliště s dobrou dostupností
   - Risky: okrajové části, panelová sídliště, sociálně vyloučené lokality

3. OBSAZENOST: Byty s nájemníkem v neprémiové lokalitě blokují reflip (nelze zobrazit, vystěhování stojí 50-100k Kč).

4. STAV NEMOVITOSTI:
   - new/novostavba: renovace 0-3000 Kč/m² (pouze kosmetika)
   - renovated/po rekonstrukci: renovace 3000-6000 Kč/m² (dílčí úpravy)
   - good/dobrý: renovace 6000-10000 Kč/m² (kompletní renovace)
   - original/původní: renovace 10000-15000 Kč/m² (generálka)
   - project/k rekonstrukci: renovace 12000-20000 Kč/m² (zásadní rekonstrukce)
   - dilapidated/zchátralý: renovace 20000+ Kč/m²

5. ENERGETICKÁ TŘÍDA: A-B prémiové, C-D standard, E-G diskont.
   Panel bez zateplení = E-G, panel po zateplení = C-D, cihla = B-D.

6. VAROVNÉ SIGNÁLY (red flags):
   - Chybějící popis nebo <20 znaků = snaží se něco skrýt
   - Eufemismy: "klidná lokalita" = okraj města, "vhodné k bydlení" = problém, "původní stav" = zchátralé, "možnost parkování" = bez garáže, "sklepní kóje" = plíseň ve sklepě
   - Cena >25 % nad tržním stropem = varování
   - Cena >50 % nad trhem = kategorické odmítnutí
   - Lokalita "risky" omezuje prodejní cenu o 15-25 %

7. TRŽNÍ CENY (Kč/m²):
   - Praha premium: 130-220k Kč/m²
   - Praha stable: 90-140k Kč/m²
   - Brno premium: 90-150k Kč/m²
   - Brno stable: 65-100k Kč/m²
   - Ostrava: 25-45k Kč/m²
   - Plzeň: 55-85k Kč/m²
   - Liberec: 40-65k Kč/m²

8. DOPORUČENÍ:
   - strongBuy: ROI ≥15 %, cena pod trhem, volný byt, bez red flags
   - buy: ROI ≥10 %, bez vážných problémů
   - consider: ROI ≥5 %, nutná due diligence
   - dontBuy: ROI <5 %, přeplatek >25 %, nebo riziková lokalita
   - categoricalReject: ztrátový, obsazeno nájemníkem, nebo >50 % nad trhem`;

const ANALYSIS_PROMPT_TEMPLATE = `Analyzuj následující inzerát nemovitosti pro flip strategii.

INZERÁT:
Název: {title}
Cena: {price} Kč ({pricePerSqm} Kč/m²)
Plocha: {area} m²
Dispozice: {rooms}
Lokalita: {address}
Stav: {condition}

Popis:
{description}

Odpověz ve formátu JSON:
{
  "summary": "Stručné zhodnocení investičního potenciálu (2-3 věty česky)",
  "sentiment": "urgent | neutral | slow (jak moc je prodejce motivovaný - urgent = cena pod trhem nebo dlouho na trhu, slow = předražené)",
  "maxBid": "maximální nabídková cena pro 15% ROI v Kč (vypočti z ARV - cílový zisk - náklady. ARV = tržní cena za m² × plocha)",
  "negotiationTips": ["konkrétní tip1", "tip2", "tip3"],
  "redFlags": ["varování1", "varování2"] nebo prázdné pole,
  "hiddenInfo": ["skrytá informace k ověření"] nebo prázdné pole,
  "comparableNotes": "Srovnání s podobnými nemovitostmi v lokalitě a doporučená kupní cena"
}

DŮLEŽITÉ:
- maxBid musí být REÁLNÉ číslo, ne řetězec
- maxBid vypočti jako: ARV × 0.85 (pro 15% marži) - náklady na renovaci
- Pokud chybí některé informace, poznamenej to do hiddenInfo
- Všechny texty piš česky`;

const DEAL_PROMPT_TEMPLATE = `Z následujícího popisu nemovitosti extrahuj informace o stavu, urgentnosti a motivaci prodejce.

Pravidla:
- Stav: novostavba = zcela nový byt/dům, po rekonstrukci = kompletně zrekonstruováno, dobrý = běžné opotřebení, původní = nezrekonstruováno, zchátralý = havarijní stav
- Urgentnost: urgent = prodává se rychle (důvod uveden), normal = standardní prodej
- Motivace: finanční důvody, dědictví, stěhování, investice, rozvod, exekuce, nebo null pokud není uvedena

Popis: "{description}"

Odpověz JSON: { "condition": "novostavba | po rekonstrukci | dobrý | původní | zchátralý | null", "urgency": "urgent | normal | null", "motivation": "finanční důvody | dědictví | stěhování | investice | rozvod | exekuce | null" }
Pokud informace není k dispozici, použij null.`;

function fallbackResult(price: number): AiAnalysisResult {
  return {
    summary: "AI analýza není k dispozici. Pro AI funkce nastav GEMINI_API_KEY v .env.local.",
    sentiment: "neutral",
    maxBid: price,
    negotiationTips: [],
    redFlags: [],
    hiddenInfo: [],
    comparableNotes: "",
  };
}

export async function analyzeListing(input: AiAnalysisInput): Promise<AiAnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackResult(input.price);
  }

  const priceStr = input.price?.toLocaleString() ?? "neuvedeno";
  const pricePerSqmStr = input.pricePerSqm?.toLocaleString() ?? "neuvedeno";
  const areaStr = input.area?.toString() ?? "neuvedeno";
  const roomsStr = input.rooms ?? "neuvedeno";
  const addressStr = input.address ?? "neuvedeno";
  const conditionStr = input.condition ?? "neuvedeno";
  const descriptionStr = input.description ?? "neuvedeno";

  const prompt = ANALYSIS_PROMPT_TEMPLATE
    .replace("{title}", input.title)
    .replace("{price}", priceStr)
    .replace("{pricePerSqm}", pricePerSqmStr)
    .replace("{area}", areaStr)
    .replace("{rooms}", roomsStr)
    .replace("{address}", addressStr)
    .replace("{condition}", conditionStr)
    .replace("{description}", descriptionStr);

  try {
    const response = await getClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "user", parts: [{ text: prompt }] },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text) as AiAnalysisResult;
    return result;
  } catch (error) {
    console.error("AI analysis error:", error);
    return {
      summary: "AI analýza není k dispozici. Zkuste to prosím později.",
      sentiment: "neutral",
      maxBid: input.price,
      negotiationTips: [],
      redFlags: [],
      hiddenInfo: [],
      comparableNotes: "",
    };
  }
}

export async function analyzeDealDescription(description: string): Promise<DealAnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { condition: null, urgency: null, motivation: null };
  }

  const prompt = DEAL_PROMPT_TEMPLATE.replace("{description}", description);

  try {
    const response = await getClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) return { condition: null, urgency: null, motivation: null };
    return JSON.parse(text);
  } catch {
    return { condition: null, urgency: null, motivation: null };
  }
}
