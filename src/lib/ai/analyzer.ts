import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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

export async function analyzeListing(input: AiAnalysisInput): Promise<AiAnalysisResult> {
  const prompt = `Jsi expert na realitní investice v České republice. Analyzuj následující inzerát nemovitosti pro flip strategii.

INZERÁT:
Název: ${input.title}
Cena: ${input.price?.toLocaleString()} Kč (${input.pricePerSqm?.toLocaleString()} Kč/m²)
Plocha: ${input.area} m²
Dispozice: ${input.rooms}
Lokalita: ${input.address}
Stav: ${input.condition}

Popis:
${input.description}

Odpověz ve formátu JSON:
{
  "summary": "Stručné zhodnocení investičního potenciálu (2-3 věty česky)",
  "sentiment": "urgent | neutral | slow (jak moc je prodejce motivovaný)",
  "maxBid": "maximální nabídková cena v Kč (číslo)",
  "negotiationTips": ["tip1", "tip2", "tip3"],
  "redFlags": ["varování1", "varování2"] nebo prázdné pole,
  "hiddenInfo": ["skrytá informace1"] nebo prázdné pole,
  "comparableNotes": "Poznámka k porovnatelným nemovitostem"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Jsi expert na realitní investice. Odpovídáš pouze validním JSONem bez formátování.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const result = JSON.parse(content) as AiAnalysisResult;
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

export async function analyzeDealDescription(description: string): Promise<{
  condition: string | null;
  urgency: string | null;
  motivation: string | null;
}> {
  const prompt = `Z následujícího popisu nemovitosti extrahuj informace o:

1. Stav nemovitosti (novostavba, po rekonstrukci, dobrý, původní, zchátralý)
2. Urgentnost prodeje (proč se prodává?)
3. Motivace prodejce (potřebuje rychle prodat?)

Popis: "${description}"

Odpověz JSON: { "condition": "...", "urgency": "..." , "motivation": "..." }
Pokud informace není k dispozici, použij null.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { condition: null, urgency: null, motivation: null };
    return JSON.parse(content);
  } catch {
    return { condition: null, urgency: null, motivation: null };
  }
}
