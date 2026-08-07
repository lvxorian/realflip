/**
 * AI zdůvodnění odhadu — Gemini.
 *
 * Stejný princip jako locality-guard: model NESMÍ vymýšlet čísla. Dostane
 * kompletní výsledek odhadu (JSON) a má ho jen srozumitelně vysvětlit česky.
 * Selhání API → null (tichý fallback, UI ukáže odhad bez AI komentáře).
 */

import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "@/lib/ai/gemini";
import type { ValuationAiOutput, ValuationInput, ValuationResult } from "./types";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

export async function explainValuation(
  input: ValuationInput,
  result: ValuationResult
): Promise<ValuationAiOutput | null> {
  const c = client();
  if (!c) return null;

  const prompt = `Jsi analytik oceňování nemovitostí. NÍŽE je výsledek automatického odhadu ceny nemovitosti (rozmezí, medián, zdroje dat, srovnatelné). 
NEVYMYŠLEJ si žádná čísla — NEpřidávej vlastní cenové odhady, nepoužívej jiná čísla než ta v JSONu. 
Vysvětli odhad srozumitelně česky pro realitního investora.

Vstupní údaje:
${JSON.stringify({
  cityKey: input.cityKey,
  address: input.address,
  type: input.type,
  disposition: input.disposition,
  area: input.area,
  condition: input.condition,
  buildingType: input.buildingType,
  askingPrice: input.askingPrice,
})}

Výsledek odhadu:
${JSON.stringify({
  estimate: result.estimate,
  low: result.low,
  high: result.high,
  pricePerSqm: result.pricePerSqm,
  confidenceLabel: result.confidenceLabel,
  sources: result.sources.map((s) => ({ label: s.label, pricePerSqm: s.pricePerSqm, sampleSize: s.sampleSize, note: s.note })),
  vsAskingPct: result.vsAskingPct,
  csuzGrowthPct: result.csuzIndex?.growthPct,
})}

Odpověz JSON:
{
  "summary": "hlavní závěr 2-3 věty česky",
  "drivers": ["2-4 klíčové faktory, které cenu určují (česky, krátké)"],
  "caveats": ["1-3 upozornění na rizika / omezení odhadu (česky)"]
}`;

  try {
    const res = await c.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
    const text = res.text ?? "";
    const parsed = JSON.parse(text) as ValuationAiOutput;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      drivers: Array.isArray(parsed.drivers) ? parsed.drivers.map(String) : [],
      caveats: Array.isArray(parsed.caveats) ? parsed.caveats.map(String) : [],
    };
  } catch (e) {
    console.error("Valuation AI failed:", e);
    return null;
  }
}
