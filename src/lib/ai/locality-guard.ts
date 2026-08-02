import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "@/lib/ai/gemini";
import type { LocalityFactors } from "@/lib/locality/types";

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return _client;
}

export interface LocalityVerdict {
  ok: boolean;
  warnings: string[];
  notes: string;
  checkedAt: number;
  source: "gemini";
}

interface GuardInput {
  cityKey: string;
  district: string | null;
  address: string | null;
  title: string | null;
  price: number | null;
  area: number | null;
  factors: LocalityFactors;
}

/**
 * AI sanity-check lokality dat. Spouští se jen když jsou data podezřelá
 * (walkability 0, cena/m² mimo rozsah, nájem null, sampleSize=0).
 * Gemini NESMÍ vymýšlet čísla — pokud nemá data, vrátí null/poznámku.
 */
export async function aiLocalityGuard(input: GuardInput): Promise<LocalityVerdict | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const pricePerSqm =
    input.price != null && input.area != null && input.area > 0 ? Math.round(input.price / input.area) : null;

  const prompt = `Jsi data kvalitní kontrolor realitní analýzy. Ověř rozumnost NÍŽE UVEDENÝCH lokalitních dat nemovitosti. NEVYMYŠLEJ si žádná čísla — nepřidávej vlastní odhady cen, nezaměstnanosti ani kriminality. Posuď POUZE, jestli uvedené hodnoty dávají smysl v českém kontextu, a označ podezřelé.

NEMOVITOST:
Název: ${input.title ?? "neuvedeno"}
Adresa: ${input.address ?? "neuvedeno"}
Město: ${input.cityKey} ${input.district ? `(${input.district})` : ""}
Cena: ${input.price ? input.price.toLocaleString() : "neuvedeno"} Kč
Plocha: ${input.area ?? "neuvedeno"} m²
Cena/m²: ${pricePerSqm ? pricePerSqm.toLocaleString() : "neuvedeno"} Kč/m²

LOKALITNÍ DATA:
- Skóre lokality: ${input.factors.total}/100
- Ekonomika (nezaměstnanost ${input.factors.economic.unemploymentPct ?? "neuvedeno"} %, firmy ${input.factors.economic.firms ?? "neuvedeno"})
- Demografie (migrace ${input.factors.demographic.migrationNet ?? "neuvedeno"}‰, populace ${input.factors.demographic.population ?? "neuvedeno"})
- Vybavenost (walkability ${input.factors.walkability.score}/100, POI: ${JSON.stringify(input.factors.walkability.counts)})
- Doprava (${input.factors.transport.score}/100, prémie ${input.factors.transport.premiumPct ?? "neuvedeno"} %)
- Bezpečnost (index kriminality ${input.factors.safety.crimeIndex ?? "neuvedeno"} TČ/100k)
- Renta (nájem/m² ${input.factors.rental.rentPerSqm ?? "neuvedeno"} Kč, hrubý výnos ${input.factors.rental.grossYieldPct ?? "neuvedeno"} %)

Odpověz JSON (striktně):
{
  "ok": true/false,
  "warnings": ["konkrétní varování v češtině, POUZE pokud nějaká hodnota nedává smysl"],
  "notes": "krátké hodnocení (1-2 věty česky), nebo prázdný řetězec pokud je vše v pořádku"
}

PRAVIDLA:
- walkability 0-20 pro centrum velkého města (Praha, Brno) = podezřelé
- cena/m² mimo 10000-300000 Kč = podezřelé
- hrubý výnos > 20 % = podezřelé
- index kriminality mimo 500-8000 = podezřelé
- NEVYMYŠLEJ si hodnoty, které zde nejsou. warnings jen na základě zadaných dat.`;

  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const text = response.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { ok: boolean; warnings: string[]; notes: string };
    return {
      ok: parsed.ok !== false,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      checkedAt: Date.now(),
      source: "gemini",
    };
  } catch (e) {
    console.error("AI locality guard error:", e);
    return null;
  }
}

/**
 * Rozhodne, jestli data vyžadují AI kontrolu (jen podezřelá data).
 */
export function needsLocalityGuard(input: {
  cityKey: string;
  walkability: number | null;
  pricePerSqm: number | null;
  grossYieldPct: number | null;
  crimeIndex: number | null;
  rentPerSqm: number | null;
}): boolean {
  const { cityKey, walkability, pricePerSqm, grossYieldPct, crimeIndex, rentPerSqm } = input;
  const isBigCity = cityKey === "praha" || cityKey === "brno" || cityKey === "ostrava" || cityKey === "plzen";
  if (isBigCity && walkability != null && walkability <= 20) return true;
  if (pricePerSqm != null && (pricePerSqm < 10000 || pricePerSqm > 300000)) return true;
  if (grossYieldPct != null && grossYieldPct > 20) return true;
  if (crimeIndex != null && (crimeIndex < 500 || crimeIndex > 8000)) return true;
  // Nájem null ve velkém městě = chybí data (možná zastaralé)
  if (isBigCity && rentPerSqm == null) return true;
  return false;
}
